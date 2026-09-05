import { Group, Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import createMovementController from '../MovementController/MovementController'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'
import { isValidActionableMethod } from '../utils'

const FIELD_UNIT = 4096

const SOLID_Z_MINIMUM = -127 / FIELD_UNIT
const SOLID_Z_MAXIMUM = 128 / FIELD_UNIT
const TALK_Z_WINDOW = 256 / FIELD_UNIT

const TALK_FACING_LIMIT = 64

export type FieldEntity = {
  isPushable: boolean
  isSolid: boolean
  isTalkable: boolean
  position: Vector3
  pushRadius: number
  scriptController: ReturnType<typeof createScriptController>
  talkRadius: number
}

type EntityUserData = {
  movementController?: ReturnType<typeof createMovementController>
  partyMemberId?: number
  scriptController?: ReturnType<typeof createScriptController>
  useScriptStateStore?: ScriptStateStore
}

const isPartyControlled = (partyMemberId?: number) => {
  if (partyMemberId === undefined) {
    return false
  }
  const { party, partyMembersFollowing } = useGlobalStore.getState()
  if (!party.includes(partyMemberId)) {
    return false
  }
  return party[0] === partyMemberId || partyMembersFollowing.includes(partyMemberId)
}

const toFieldEntity = (group: Group): FieldEntity | null => {
  const { movementController, partyMemberId, scriptController, useScriptStateStore } = group.userData as EntityUserData
  if (!movementController || !scriptController || !useScriptStateStore) {
    return null
  }
  if (scriptController.script.type !== 'model' || isPartyControlled(partyMemberId)) {
    return null
  }

  const state = useScriptStateStore.getState()
  if (state.isUnused || !state.isVisible) {
    return null
  }

  const { hasBeenPlaced, position } = movementController.getState()
  if (!hasBeenPlaced) {
    return null
  }

  return {
    isPushable: state.isPushable,
    isSolid: state.isSolid,
    isTalkable: state.isTalkable,
    position: position.current,
    pushRadius: state.pushRadius,
    scriptController,
    talkRadius: state.talkRadius,
  }
}

export const collectEntityGroups = (scene: Scene) => {
  const groups: Group[] = []
  scene.traverse((object) => {
    if (object.name.startsWith('entity--')) {
      groups.push(object as Group)
    }
  })
  return groups
}

export const getFieldEntities = (groups: Group[]) =>
  groups.map(toFieldEntity).filter((entity): entity is FieldEntity => entity !== null)

// `sub_47A720`: two entities overlap when the planar distance is inside the mean
// of their push radii, and their heights are within a ±128 unit window.
export const getOverlappingEntities = (position: Vector3, pushRadius: number, entities: FieldEntity[]) =>
  entities.filter((entity) => {
    const deltaZ = entity.position.z - position.z
    if (deltaZ <= SOLID_Z_MINIMUM || deltaZ >= SOLID_Z_MAXIMUM) {
      return false
    }
    const radius = Math.floor((pushRadius + entity.pushRadius) / 2) / FIELD_UNIT
    const deltaX = entity.position.x - position.x
    const deltaY = entity.position.y - position.y
    return radius * radius > deltaX * deltaX + deltaY * deltaY
  })

const hasMethod = (scriptController: ReturnType<typeof createScriptController>, methodId: string) =>
  isValidActionableMethod(scriptController.script.methods.find((method) => method.methodId === methodId))

export const getPushTarget = (entities: FieldEntity[]) =>
  entities.find((entity) => entity.isPushable && hasMethod(entity.scriptController, 'push'))

// Angle 0 faces (0, -1, 0) and increases anticlockwise around +Z, in 256ths of a turn.
const getAngleToDelta = (deltaX: number, deltaY: number) => {
  const units = (Math.atan2(deltaX, -deltaY) / (2 * Math.PI)) * 256
  return ((units % 256) + 256) % 256
}

const getFacingDifference = (fromAngle: number, toAngle: number) => {
  const difference = (((fromAngle - toAngle) % 256) + 256) % 256
  return difference > 128 ? 256 - difference : difference
}

const getTalkScore = (position: Vector3, angle: number, pushRadius: number, entity: FieldEntity) => {
  if (!entity.isTalkable || !hasMethod(entity.scriptController, 'talk')) {
    return TALK_FACING_LIMIT
  }
  const deltaX = entity.position.x - position.x
  const deltaY = entity.position.y - position.y
  if (deltaX === 0 && deltaY === 0) {
    return TALK_FACING_LIMIT
  }
  if (Math.abs(entity.position.z - position.z) >= TALK_Z_WINDOW) {
    return TALK_FACING_LIMIT
  }
  if (Math.hypot(deltaX, deltaY) >= (pushRadius + entity.talkRadius) / FIELD_UNIT) {
    return TALK_FACING_LIMIT
  }
  return getFacingDifference(angle, getAngleToDelta(deltaX, deltaY))
}

// `sub_4796E0`: of every entity inside the player's push radius plus its own talk
// radius, the one nearest to dead ahead is the single entity the press reaches.
export const findTalkTarget = (position: Vector3, angle: number, pushRadius: number, entities: FieldEntity[]) =>
  entities.reduce<{ entity: FieldEntity | null; score: number }>(
    (best, entity) => {
      const score = getTalkScore(position, angle, pushRadius, entity)
      return score < best.score ? { entity, score } : best
    },
    { entity: null, score: TALK_FACING_LIMIT },
  ).entity
