import { VEHICLE_IDS } from '../../../constants/vehicles'
import {
  ALTERNATE_ENTITY_SUBTYPE,
  ALTERNATE_SUBTYPE_ENTITY_TYPE,
  CHICOBO_ENTITY_TYPE,
  GARDEN_ENTITY_TYPES,
  LOOSE_CANDIDATE_DISTANCE,
  MAX_WORLDMAP_ENTITIES,
  RAGNAROK_ENTITY_TYPE,
  SPINNING_ENTITY_SUBTYPE,
  TIGHT_CANDIDATE_DISTANCE,
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
import { getEntityVehicleCategory, isGardenEntityType } from '../vehicleEntities'
import {
  hasChicoboOnWorldmap,
  readSavedCarEntityType,
  readSavedRagnarok,
  readSavedVehiclePosition,
  SavedVehiclePosition,
} from '../worldmapSaveData'
import useWorldmapStore from '../worldmapStore'

const buildSavedEntity = (saved: SavedVehiclePosition, typeCode: number, subType: number): EntityRecord => ({
  pitch: 0,
  positionVerticalY: saved.altitude,
  positionX: saved.x,
  positionY: saved.y,
  subType,
  typeCode,
  yaw: saved.yaw,
})

const buildSavedVehicleEntity = (vehicleId: number, typeCode: number, subType: number) => {
  const saved = readSavedVehiclePosition(MEMORY, vehicleId)
  return saved && buildSavedEntity(saved, typeCode, subType)
}

const getGardenSubType = (typeCode: number) => (typeCode === GARDEN_ENTITY_TYPES[1] ? SPINNING_ENTITY_SUBTYPE : 0)

const buildSavedCarEntity = () => {
  const typeCode = readSavedCarEntityType(MEMORY)
  const vehicleId = typeCode === undefined ? undefined : getEntityVehicleCategory(typeCode)
  if (typeCode === undefined || vehicleId === undefined) {
    return undefined
  }
  return buildSavedVehicleEntity(vehicleId, typeCode, 0)
}

const getSpawnSubType = (typeCode: number) =>
  typeCode === ALTERNATE_SUBTYPE_ENTITY_TYPE ? ALTERNATE_ENTITY_SUBTYPE : 0

const resolveSpawn = ({ positionIndex, typeCode }: RawSpawn, positions: readonly EntityPosition[]) => {
  if (typeCode === RAGNAROK_ENTITY_TYPE) {
    return buildSavedEntity(readSavedRagnarok(MEMORY), RAGNAROK_ENTITY_TYPE, 0)
  }
  if (isGardenEntityType(typeCode)) {
    return buildSavedVehicleEntity(VEHICLE_IDS.BALAMB_GARDEN, typeCode, getGardenSubType(typeCode))
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

const isSpawnAllowed = ({ typeCode }: RawSpawn) => typeCode !== CHICOBO_ENTITY_TYPE || hasChicoboOnWorldmap(MEMORY)

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
  [
    ...collectSpawns(section, position)
      .filter(isSpawnAllowed)
      .map((spawn) => resolveSpawn(spawn, positions)),
    buildSavedCarEntity(),
  ]
    .filter((entity): entity is EntityRecord => entity !== undefined)
    .slice(0, MAX_WORLDMAP_ENTITIES)

export const countRefresh = (count: number) => count + 1

export const subscribeToVehicleChanges = (onChange: () => void) =>
  useWorldmapStore.subscribe((state, previousState) => {
    if (state.vehicleId !== previousState.vehicleId) {
      onChange()
    }
  })
