import { signExtend16 } from '../../utils'
import { MINIMAP_MODE_HIDDEN, MINIMAP_MODE_LARGE } from './Minimap/constants'

export type Memory = Record<number, number>

type SavedPartyState = {
  cameraYaw: number
  vehicleId: number
}

type SavedRagnarok = {
  altitude: number
  x: number
  y: number
  yaw: number
}

type SavedWorldmapModes = {
  cameraModeIndex: number
  minimapMode: number
}

const SAVEMAP_WORLD_STATE_BYTE = 266
const WORLD_STATE_MASK = 0x1f

const SAVEMAP_WORLDMAP_BASE = 1280
const SAVEMAP_RAGNAROK_X = SAVEMAP_WORLDMAP_BASE + 24
const SAVEMAP_RAGNAROK_Y = SAVEMAP_WORLDMAP_BASE + 28
const SAVEMAP_RAGNAROK_ALTITUDE = SAVEMAP_WORLDMAP_BASE + 32
const SAVEMAP_RAGNAROK_YAW = SAVEMAP_WORLDMAP_BASE + 34
const SAVEMAP_CAMERA_YAW = SAVEMAP_WORLDMAP_BASE + 96
const SAVEMAP_VEHICLE = SAVEMAP_WORLDMAP_BASE + 105
const SAVEMAP_CAMERA_MODE = SAVEMAP_WORLDMAP_BASE + 108
const SAVEMAP_BATTLE_STATE = SAVEMAP_WORLDMAP_BASE + 109
const SAVEMAP_MINIMAP_MODE = SAVEMAP_WORLDMAP_BASE + 110
const SAVEMAP_BIT_FLAGS = SAVEMAP_WORLDMAP_BASE + 116
const SAVEMAP_SCRIPT_VARIABLES = SAVEMAP_WORLDMAP_BASE + 124

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

export const readSavedRagnarok = (memory: Memory): SavedRagnarok => ({
  altitude: signExtend16(memory[SAVEMAP_RAGNAROK_ALTITUDE] ?? 0),
  x: memory[SAVEMAP_RAGNAROK_X] ?? 0,
  y: memory[SAVEMAP_RAGNAROK_Y] ?? 0,
  yaw: signExtend16(memory[SAVEMAP_RAGNAROK_YAW] ?? 0),
})

export const writeSavedRagnarok = (memory: Memory, ragnarok: SavedRagnarok) => {
  memory[SAVEMAP_RAGNAROK_X] = ragnarok.x
  memory[SAVEMAP_RAGNAROK_Y] = ragnarok.y
  memory[SAVEMAP_RAGNAROK_ALTITUDE] = ragnarok.altitude
  memory[SAVEMAP_RAGNAROK_YAW] = ragnarok.yaw
}

export const writeSavedPartyState = (memory: Memory, state: SavedPartyState) => {
  memory[SAVEMAP_CAMERA_YAW] = state.cameraYaw
  memory[SAVEMAP_VEHICLE] = state.vehicleId
}

export const readSavedBattleState = (memory: Memory) => memory[SAVEMAP_BATTLE_STATE] ?? 0

const getFlagByteAddress = (wordIndex: number, bit: number) =>
  SAVEMAP_BIT_FLAGS + wordIndex * BYTES_PER_FLAG_WORD + Math.floor(bit / BITS_PER_BYTE)

export const readSavedFlagBit = (memory: Memory, wordIndex: number, bit: number) =>
  ((memory[getFlagByteAddress(wordIndex, bit)] ?? 0) >> (bit % BITS_PER_BYTE)) & 1

export const getFlagWordIndex = (flagNumber: number) => (flagNumber >= BITS_PER_FLAG_WORD ? 1 : 0)

export const readSavedScriptVariable = (memory: Memory, index: number) => memory[SAVEMAP_SCRIPT_VARIABLES + index] ?? 0
