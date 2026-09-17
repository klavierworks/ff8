import { VEHICLE_IDS } from '../../constants/vehicles'
import { signExtend16 } from '../../utils'
import { MINIMAP_MODE_HIDDEN, MINIMAP_MODE_LARGE } from './Minimap/constants'
import { isCarClass, isWalkerClass } from './vehicleClasses'

export type Memory = Record<number, number>

export type SavedVehiclePosition = {
  altitude: number
  x: number
  y: number
  yaw: number
}

type SavedPartyState = {
  cameraYaw: number
  vehicleId: number
}

type SavedWorldmapModes = {
  cameraModeIndex: number
  minimapMode: number
}

const SAVEMAP_WORLD_STATE_BYTE = 266
const WORLD_STATE_MASK = 0x1f

const SAVEMAP_WORLDMAP_BASE = 1280
const SAVEMAP_CHOCOBO_WORLD_FLAGS = 1536
const CHOCOBO_WORLD_SPAWN_BIT = 0x01
const CHOCOBO_WORLD_SUPPRESS_BIT = 0x02
const SAVEMAP_VEHICLE_RECORD_SIZE = 12
const VEHICLE_RECORD_Y_OFFSET = 4
const VEHICLE_RECORD_ALTITUDE_OFFSET = 8
const VEHICLE_RECORD_YAW_OFFSET = 10
const SAVEMAP_CAMERA_YAW = SAVEMAP_WORLDMAP_BASE + 96
const SAVEMAP_CAR_ENTITY_TYPE = SAVEMAP_WORLDMAP_BASE + 98
const SAVEMAP_VEHICLE = SAVEMAP_WORLDMAP_BASE + 105
const SAVEMAP_CAMERA_MODE = SAVEMAP_WORLDMAP_BASE + 108
const SAVEMAP_BATTLE_STATE = SAVEMAP_WORLDMAP_BASE + 109
const SAVEMAP_MINIMAP_MODE = SAVEMAP_WORLDMAP_BASE + 110
const SAVEMAP_BIT_FLAGS = SAVEMAP_WORLDMAP_BASE + 116
const SAVEMAP_SCRIPT_VARIABLES = SAVEMAP_WORLDMAP_BASE + 124

const PARTY_RECORD_SLOT = 0
const RAGNAROK_RECORD_SLOT = 2
const GARDEN_RECORD_SLOT = 3
const CAR_RECORD_SLOT = 4

const BITS_PER_FLAG_WORD = 32
const BYTES_PER_FLAG_WORD = 4
const BITS_PER_BYTE = 8

export const getWorldStateVariable = (memory: Memory) => (memory[SAVEMAP_WORLD_STATE_BYTE] ?? 0) & WORLD_STATE_MASK

export const readSavedCameraMode = (memory: Memory) => memory[SAVEMAP_CAMERA_MODE] ?? 0

export const writeSavedCameraMode = (memory: Memory, cameraModeIndex: number) => {
  memory[SAVEMAP_CAMERA_MODE] = cameraModeIndex
}

export const readSavedWorldmapModes = (memory: Memory): SavedWorldmapModes => ({
  cameraModeIndex: readSavedCameraMode(memory),
  minimapMode: memory[SAVEMAP_MINIMAP_MODE] ?? MINIMAP_MODE_HIDDEN,
})

const getPersistedMinimapMode = (minimapMode: number) =>
  minimapMode === MINIMAP_MODE_LARGE ? MINIMAP_MODE_HIDDEN : minimapMode

export const writeSavedWorldmapModes = (memory: Memory, modes: SavedWorldmapModes) => {
  writeSavedCameraMode(memory, modes.cameraModeIndex)
  memory[SAVEMAP_MINIMAP_MODE] = getPersistedMinimapMode(modes.minimapMode)
}

const getVehicleRecordSlot = (vehicleId: number) => {
  if (isWalkerClass(vehicleId)) {
    return PARTY_RECORD_SLOT
  }
  if (vehicleId === VEHICLE_IDS.RAGNAROK) {
    return RAGNAROK_RECORD_SLOT
  }
  if (vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    return GARDEN_RECORD_SLOT
  }
  if (isCarClass(vehicleId)) {
    return CAR_RECORD_SLOT
  }
  return undefined
}

const getRecordAddress = (slot: number) => SAVEMAP_WORLDMAP_BASE + slot * SAVEMAP_VEHICLE_RECORD_SIZE

const readVehicleRecord = (memory: Memory, address: number): SavedVehiclePosition => ({
  altitude: signExtend16(memory[address + VEHICLE_RECORD_ALTITUDE_OFFSET] ?? 0),
  x: memory[address] ?? 0,
  y: memory[address + VEHICLE_RECORD_Y_OFFSET] ?? 0,
  yaw: signExtend16(memory[address + VEHICLE_RECORD_YAW_OFFSET] ?? 0),
})

const writeVehicleRecord = (memory: Memory, address: number, position: SavedVehiclePosition) => {
  memory[address] = position.x
  memory[address + VEHICLE_RECORD_Y_OFFSET] = position.y
  memory[address + VEHICLE_RECORD_ALTITUDE_OFFSET] = position.altitude
  memory[address + VEHICLE_RECORD_YAW_OFFSET] = position.yaw
}

export const readSavedVehiclePosition = (memory: Memory, vehicleId: number) => {
  const slot = getVehicleRecordSlot(vehicleId)
  if (slot === undefined || memory[getRecordAddress(slot)] === undefined) {
    return undefined
  }
  return readVehicleRecord(memory, getRecordAddress(slot))
}

export const writeSavedVehiclePosition = (memory: Memory, vehicleId: number, position: SavedVehiclePosition) => {
  const slot = getVehicleRecordSlot(vehicleId)
  if (slot === undefined) {
    return
  }
  writeVehicleRecord(memory, getRecordAddress(slot), position)
}

export const readSavedRagnarok = (memory: Memory) => readVehicleRecord(memory, getRecordAddress(RAGNAROK_RECORD_SLOT))

export const readSavedPartyState = (memory: Memory): SavedPartyState => ({
  cameraYaw: signExtend16(memory[SAVEMAP_CAMERA_YAW] ?? 0),
  vehicleId: memory[SAVEMAP_VEHICLE] ?? VEHICLE_IDS.ON_FOOT,
})

export const writeSavedPartyState = (memory: Memory, state: SavedPartyState) => {
  memory[SAVEMAP_CAMERA_YAW] = state.cameraYaw
  memory[SAVEMAP_VEHICLE] = state.vehicleId
}

const NO_CAR_ENTITY_TYPE = 0xff

export const readSavedCarEntityType = (memory: Memory) => {
  const typeCode = memory[SAVEMAP_CAR_ENTITY_TYPE] ?? NO_CAR_ENTITY_TYPE
  return typeCode === NO_CAR_ENTITY_TYPE ? undefined : typeCode
}

export const writeSavedCarEntityType = (memory: Memory, typeCode: number) => {
  memory[SAVEMAP_CAR_ENTITY_TYPE] = typeCode
}

export const readSavedBattleState = (memory: Memory) => memory[SAVEMAP_BATTLE_STATE] ?? 0

export const writeSavedLocationTriggerBit = (memory: Memory, isTriggerSet: boolean) => {
  memory[SAVEMAP_BATTLE_STATE] = (readSavedBattleState(memory) & ~1) | (isTriggerSet ? 1 : 0)
}

const getFlagByteAddress = (wordIndex: number, bit: number) =>
  SAVEMAP_BIT_FLAGS + wordIndex * BYTES_PER_FLAG_WORD + Math.floor(bit / BITS_PER_BYTE)

export const readSavedFlagBit = (memory: Memory, wordIndex: number, bit: number) =>
  ((memory[getFlagByteAddress(wordIndex, bit)] ?? 0) >> (bit % BITS_PER_BYTE)) & 1

export const writeSavedFlagBit = (memory: Memory, wordIndex: number, bit: number, isSet: boolean) => {
  const address = getFlagByteAddress(wordIndex, bit)
  const mask = 1 << (bit % BITS_PER_BYTE)
  const current = memory[address] ?? 0
  memory[address] = isSet ? current | mask : current & ~mask
}

export const getFlagWordIndex = (flagNumber: number) => (flagNumber >= BITS_PER_FLAG_WORD ? 1 : 0)

export const readSavedScriptVariable = (memory: Memory, index: number) => memory[SAVEMAP_SCRIPT_VARIABLES + index] ?? 0

export const writeSavedScriptVariable = (memory: Memory, index: number, value: number) => {
  memory[SAVEMAP_SCRIPT_VARIABLES + index] = value
}

export const hasChicoboOnWorldmap = (memory: Memory) => {
  const flags = memory[SAVEMAP_CHOCOBO_WORLD_FLAGS] ?? 0
  return (flags & CHOCOBO_WORLD_SPAWN_BIT) !== 0 && (flags & CHOCOBO_WORLD_SUPPRESS_BIT) === 0
}
