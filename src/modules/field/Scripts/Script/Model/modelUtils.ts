import { Group, Object3D, Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import createMovementController from '../MovementController/MovementController'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'

export type InteractiveEntity = {
  isPushable: boolean
  isSolid: boolean
  isTalkable: boolean
  position: Vector3
  pushRadius: number
  scriptController: ReturnType<typeof createScriptController>
  talkRadius: number
}

export const getScriptEntity = (scene: Scene, scriptGroupId: number) => {
  return scene.getObjectByName(`entity--${scriptGroupId}`) as Group
}

export const getPartyMemberModelComponent = (scene: Scene, partyMemberIndex: number): Group | null => {
  const { party } = useGlobalStore.getState()
  const partyMemberId = party[partyMemberIndex]
  if (partyMemberId === undefined) {
    return null
  }
  const partyMemberGroup = scene.getObjectByName(`party--${partyMemberId}`) as Object3D
  if (!partyMemberGroup) {
    return null
  }

  return partyMemberGroup.parent as Group
}

export const getPlayerEntity = (scene: Scene): Group | null => {
  const { party } = useGlobalStore.getState()
  const partyMemberId = party[0]

  const groupWrapper = scene.getObjectByName(`party--${partyMemberId}`) as Group
  if (!groupWrapper) {
    console.warn('Player entity not found in scene')
    return null
  }

  return groupWrapper.parent as Group
}

const isPartyControlled = (partyMemberId?: number) => {
  if (partyMemberId === undefined) {
    return false
  }
  const { party, partyMembersFollowing } = useGlobalStore.getState()
  return party[0] === partyMemberId || partyMembersFollowing.includes(partyMemberId)
}

const readInteractiveEntity = (object: Object3D): InteractiveEntity | null => {
  if (!object.name.startsWith('entity--') || isPartyControlled(object.userData.partyMemberId)) {
    return null
  }

  const movementController = object.userData.movementController as ReturnType<typeof createMovementController>
  const scriptController = object.userData.scriptController as ReturnType<typeof createScriptController>
  const useScriptStateStore = object.userData.useScriptStateStore as ScriptStateStore
  if (scriptController.script.type !== 'model' || !movementController.getState().hasBeenPlaced) {
    return null
  }

  const state = useScriptStateStore.getState()

  return {
    isPushable: state.isPushable,
    isSolid: state.isSolid,
    isTalkable: state.isTalkable,
    position: movementController.getState().position.current,
    pushRadius: state.pushRadius,
    scriptController,
    talkRadius: state.talkRadius,
  }
}

export const getInteractiveEntities = (scene: Scene) => {
  const entities: InteractiveEntity[] = []
  scene.traverse((object) => {
    const entity = readInteractiveEntity(object)
    if (entity) {
      entities.push(entity)
    }
  })
  return entities
}
