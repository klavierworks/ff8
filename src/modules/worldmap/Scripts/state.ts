import { COMPANION_ENTITY_TYPES, GARDEN_ENTITY_TYPES, RAGNAROK_ENTITY_TYPE } from '../../../constants/worldmapEntities'
import { TerrainTriangle } from '../terrain'
import { isOnFootClass } from '../vehicleClasses'
import { isCarEntityType } from '../vehicleEntities'
import { LOCATION_TRIGGER_BIT } from './constants'

export type EntityRecord = {
  pitch: number
  positionVerticalY: number
  positionX: number
  positionY: number
  subType: number
  typeCode: number
  yaw: number
}

type ReservedSlots = [number, number, number, number, number, number, number]

type TypeCodePredicate = (code: number) => boolean

export const isOnFootCode = (code: number) => code >= 0 && isOnFootClass(code)

const createInitialScriptState = () => ({
  battleResult: 0,
  currentLocationIndex: 0,
  dialogChoice: 0,
  facingYaw: 0,
  isButtonInputConsumed: false,
  isMoving: false,
  isTileMode: false,
  lastCombatSceneId: 0,
  locationTriangle: undefined as TerrainTriangle | undefined,
  looseCandidate: -1,
  padCurrent: 0,
  padPrevious: 0,
  previousLocationIndex: 0,
  reservedSlots: [-1, -1, -1, -1, -1, -1, -1] as ReservedSlots,
  tightCandidate: -1,
})

export const WORLDMAP_STATE = createInitialScriptState()

export const isLocationTriggerSet = () =>
  ((WORLDMAP_STATE.locationTriangle?.triggerFlags ?? 0) & LOCATION_TRIGGER_BIT) !== 0

export const setCurrentLocationIndex = (locationIndex: number) => {
  if (locationIndex === WORLDMAP_STATE.currentLocationIndex) {
    return
  }
  WORLDMAP_STATE.previousLocationIndex = WORLDMAP_STATE.currentLocationIndex
  WORLDMAP_STATE.currentLocationIndex = locationIndex
}

let entities: readonly EntityRecord[] = []

const RESERVED_SLOT_PREDICATES: readonly TypeCodePredicate[] = [
  isOnFootCode,
  (code) => code === COMPANION_ENTITY_TYPES[0],
  (code) => code === COMPANION_ENTITY_TYPES[1],
  (code) => code === RAGNAROK_ENTITY_TYPE,
  isCarEntityType,
  (code) => code === GARDEN_ENTITY_TYPES[0],
  (code) => code === GARDEN_ENTITY_TYPES[1],
]

const findReservedSlots = (records: readonly EntityRecord[]) =>
  RESERVED_SLOT_PREDICATES.map((predicate) =>
    records.findIndex((entity) => predicate(entity.typeCode)),
  ) as ReservedSlots

export const setEntities = (records: readonly EntityRecord[]) => {
  entities = records
  WORLDMAP_STATE.reservedSlots = findReservedSlots(records)
}

export const getEntity = (index: number) => (index < 0 ? undefined : entities[index])

export const getAllEntities = () => entities

export const isReservedSlot = (index: number) => index >= 0 && WORLDMAP_STATE.reservedSlots.includes(index)

export const replaceEntity = (index: number, record: EntityRecord) => {
  entities = entities.map((entity, entityIndex) => (entityIndex === index ? record : entity))
}

export const addEntity = (record: EntityRecord) => {
  setEntities([...entities, record])
}

export const resetScriptState = () => {
  Object.assign(WORLDMAP_STATE, createInitialScriptState())
  entities = []
}
