import { VEHICLE_IDS } from '../../../constants/vehicles'
import {
  ALTERNATE_ENTITY_SUBTYPE,
  ALTERNATE_SUBTYPE_ENTITY_TYPE,
  LOOSE_CANDIDATE_DISTANCE,
  MAX_WORLDMAP_ENTITIES,
  RAGNAROK_ENTITY_TYPE,
  TIGHT_CANDIDATE_DISTANCE,
  UNTRACKED_GARDEN_ENTITY_TYPES,
} from '../../../constants/worldmapEntities'
import useGlobalStore from '../../../store'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { convertFieldDirectionToHeading } from '../Player/playerAngles'
import { worldXToPsx, worldZToPsx } from '../Player/playerUtils'
import { ScriptSection } from '../Scripts/runScript'
import { collectSpawns, RawSpawn } from '../Scripts/sectionRunners'
import { EntityRecord, WORLDMAP_STATE } from '../Scripts/state'
import { WorldPosition } from '../types'
import { EntityPosition } from '../useSections'
import { readSavedRagnarok } from '../worldmapSaveData'
import useWorldmapStore from '../worldmapStore'

const buildSavedRagnarokEntity = (): EntityRecord => {
  const saved = readSavedRagnarok(MEMORY)
  return {
    pitch: 0,
    positionVerticalY: saved.altitude,
    positionX: saved.x,
    positionY: saved.y,
    subType: 0,
    typeCode: RAGNAROK_ENTITY_TYPE,
    yaw: saved.yaw,
  }
}

const isUntrackedGardenType = (typeCode: number) =>
  (UNTRACKED_GARDEN_ENTITY_TYPES as readonly number[]).includes(typeCode)

const getSpawnSubType = (typeCode: number) =>
  typeCode === ALTERNATE_SUBTYPE_ENTITY_TYPE ? ALTERNATE_ENTITY_SUBTYPE : 0

const resolveSpawn = ({ positionIndex, typeCode }: RawSpawn, positions: readonly EntityPosition[]) => {
  if (typeCode === RAGNAROK_ENTITY_TYPE) {
    return buildSavedRagnarokEntity()
  }
  if (isUntrackedGardenType(typeCode)) {
    return undefined
  }
  const position = positions[positionIndex]
  if (!position) {
    return undefined
  }
  return {
    pitch: position.pitch,
    positionVerticalY: position.y,
    positionX: position.x,
    positionY: -position.z,
    subType: getSpawnSubType(typeCode),
    typeCode,
    yaw: position.yaw,
  }
}

export const calculateEntityDistances = (entities: readonly EntityRecord[], playerX: number, playerZ: number) => {
  const psxX = worldXToPsx(playerX)
  const psxY = worldZToPsx(playerZ)
  return entities.map((entity) => Math.hypot(entity.positionX - psxX, entity.positionY - psxY))
}

const findClosestEntity = (distances: readonly number[]) =>
  distances.reduce((closest, distance, index) => (distance < closest.distance ? { distance, index } : closest), {
    distance: Infinity,
    index: -1,
  })

const clearInteractionCandidates = () => {
  WORLDMAP_STATE.tightCandidate = -1
  WORLDMAP_STATE.looseCandidate = -1
}

export const updateInteractionCandidates = (distances: readonly number[]) => {
  if (useWorldmapStore.getState().vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    clearInteractionCandidates()
    return
  }
  const { distance, index } = findClosestEntity(distances)
  WORLDMAP_STATE.tightCandidate = distance <= TIGHT_CANDIDATE_DISTANCE ? index : -1
  WORLDMAP_STATE.looseCandidate = distance <= LOOSE_CANDIDATE_DISTANCE ? index : -1
}

export const updateFacingYaw = () => {
  WORLDMAP_STATE.facingYaw = convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)
}

export const collectEntities = (
  section: ScriptSection,
  positions: readonly EntityPosition[],
  position: WorldPosition,
) =>
  collectSpawns(section, position)
    .flatMap((spawn) => resolveSpawn(spawn, positions) ?? [])
    .slice(0, MAX_WORLDMAP_ENTITIES)
