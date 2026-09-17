import { MathUtils } from 'three'

import { WORLD_TILE_COLUMNS, WORLD_TILE_ROWS } from '../constants'
import { psxToRadians } from '../Player/playerAngles'
import { psxXToWorld, psxZToWorld } from '../Player/playerUtils'
import { WORLD_MAP_STATE_FREE_ROAM, WORLD_MAP_STATE_FULL_MAP, WorldmapState } from '../worldmapStore'
import { buildWorldPosition } from '../worldPosition'
import {
  CONE_VIEW_HEADING_OFFSET,
  HIDDEN_NEEDLE_WORLD_MAP_STATES,
  MINIMAP_MODE_COUNT,
  MINIMAP_MODE_HIDDEN,
  MINIMAP_MODE_LARGE,
  NEEDLE_ANGLE_OFFSET,
  POINTER_PULSE_BASE,
  POINTER_PULSE_MIDPOINT,
  POINTER_PULSE_PERIOD,
  POINTER_PULSE_STEP,
} from './constants'

export type MapCell = {
  cellX: number
  cellY: number
}

export const getMapCellFromWorld = (worldX: number, worldZ: number): MapCell => {
  const { tileX, tileY } = buildWorldPosition(worldX, worldZ)
  return { cellX: tileX, cellY: tileY }
}

export const getMapCellFromPsx = (psxX: number, psxY: number) =>
  getMapCellFromWorld(psxXToWorld(psxX), psxZToWorld(psxY))

export const wrapMapCell = ({ cellX, cellY }: MapCell): MapCell => ({
  cellX: MathUtils.euclideanModulo(cellX, WORLD_TILE_COLUMNS),
  cellY: MathUtils.euclideanModulo(cellY, WORLD_TILE_ROWS),
})

export const calculatePointerPulse = (frame: number) => {
  const phase = frame % POINTER_PULSE_PERIOD
  const risingValue = POINTER_PULSE_STEP * phase - 2 * POINTER_PULSE_BASE
  const value = risingValue <= 0 ? POINTER_PULSE_STEP * (POINTER_PULSE_MIDPOINT - phase) : risingValue
  return Math.floor(value / 2) + POINTER_PULSE_BASE
}

export const isNeedleShown = (worldMapState: number) =>
  !(HIDDEN_NEEDLE_WORLD_MAP_STATES as readonly number[]).includes(worldMapState)

export const calculateNeedleRotation = (fieldDirection: number) => -psxToRadians(fieldDirection + NEEDLE_ANGLE_OFFSET)

export const calculateConeRotation = (cameraYawRadians: number) => {
  const cameraViewYawRadians = cameraYawRadians + Math.PI
  return -(cameraViewYawRadians + psxToRadians(CONE_VIEW_HEADING_OFFSET))
}

const getNextMinimapMode = (minimapMode: number, worldMapState: number) => {
  const nextMode = (minimapMode + 1) % MINIMAP_MODE_COUNT
  if (nextMode === MINIMAP_MODE_LARGE && worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
    return MINIMAP_MODE_HIDDEN
  }
  return nextMode
}

const getMinimapToggleState = (nextMode: number, worldMapState: number) => {
  if (nextMode === MINIMAP_MODE_LARGE) {
    return WORLD_MAP_STATE_FULL_MAP
  }
  return worldMapState === WORLD_MAP_STATE_FULL_MAP ? WORLD_MAP_STATE_FREE_ROAM : worldMapState
}

export const calculateMinimapToggle = ({
  minimapMode,
  worldMapState,
}: Pick<WorldmapState, 'minimapMode' | 'worldMapState'>): Pick<WorldmapState, 'minimapMode' | 'worldMapState'> => {
  const nextMode = getNextMinimapMode(minimapMode, worldMapState)
  return { minimapMode: nextMode, worldMapState: getMinimapToggleState(nextMode, worldMapState) }
}

export const selectIsFullMapShown = (state: WorldmapState) => state.minimapMode === MINIMAP_MODE_LARGE
