export type EntityRecord = {
  pitch: number
  positionVerticalY: number
  positionX: number
  positionY: number
  subType: number
  typeCode: number
  yaw: number
}

export type RawSpawn = {
  positionIndex: number
  typeCode: number
}

export const WORLDMAP_STATE = {
  battleResult: 0,
  bitFlags: [0, 0] as [number, number],
  currentLocationFlags: 0,
  currentLocationIndex: 0,
  dialogChoice: 0,
  facingYaw: 0,
  inputCurrent: 0,
  inputPrevious: 0,
  isGlobalEventTriggered: false,
  isInputLocked: false,
  isMoving: false,
  isTileMode: false,
  lastCombatSceneId: 0,
  looseCandidate: -1,
  previousLocationIndex: 0,
  reservedSlots: [-1, -1, -1, -1, -1, -1, -1] as [number, number, number, number, number, number, number],
  scriptVars: [0, 0] as [number, number],
  tightCandidate: -1,
  worldMapState: 0,
}

let entities: readonly EntityRecord[] = []

type LocationCodePredicate = (code: number) => boolean

// Reserved-slot scan: first entity whose type-code matches each predicate.
// Slot 0 = party on foot (codes 0-9 or 128); slot 4 is filled elsewhere from the
// spawn list, so its predicate never matches and the slot stays unfilled (-1).
const RESERVED_SLOT_PREDICATES: readonly LocationCodePredicate[] = [
  (code) => (code >= 0 && code <= 9) || code === 128,
  (code) => code === 2,
  (code) => code === 3,
  (code) => code === 1,
  () => false,
  (code) => code === 64,
  (code) => code === 65,
]

const findReservedSlots = (list: readonly EntityRecord[]): [number, number, number, number, number, number, number] => {
  const slots = RESERVED_SLOT_PREDICATES.map((predicate) => list.findIndex((entity) => predicate(entity.typeCode)))
  return slots as [number, number, number, number, number, number, number]
}

export const setEntities = (list: readonly EntityRecord[]) => {
  entities = list
  WORLDMAP_STATE.reservedSlots = findReservedSlots(list)
}

export const getEntity = (index: number): EntityRecord | undefined => (index < 0 ? undefined : entities[index])

export const getAllEntities = (): readonly EntityRecord[] => entities

export const isReservedSlot = (index: number): boolean => index >= 0 && WORLDMAP_STATE.reservedSlots.includes(index)

let activeSpawnCollector: null | RawSpawn[] = null

export const beginSpawnCollection = (): RawSpawn[] => {
  const collector: RawSpawn[] = []
  activeSpawnCollector = collector
  return collector
}

export const endSpawnCollection = () => {
  activeSpawnCollector = null
}

export const pushSpawn = (typeCode: number, positionIndex: number) => {
  if (activeSpawnCollector !== null) {
    activeSpawnCollector.push({ positionIndex, typeCode })
  }
}
