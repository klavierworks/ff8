import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import { MINIMAP_MODE_LARGE } from '../Minimap/constants'
import { getEntryDelayFrames } from '../worldmapEntry'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM, WorldmapControlsState } from '../worldmapStore'
import { DPAD_DIAGONAL_MAGNITUDE, DPAD_MAGNITUDE } from './constants'
import { getWorldmapEntryTick } from './movementState'

export type OnFootInput = {
  isMoving: boolean
  isNoSteering: boolean
  x: number
  z: number
}

const IDLE_INPUT: OnFootInput = { isMoving: false, isNoSteering: true, x: 0, z: 0 }

export const isPadInputIgnored = (tick: number) => {
  const { entryMode, isExiting, minimapMode, worldMapState } = useWorldmapStore.getState()
  return (
    tick - getWorldmapEntryTick() < getEntryDelayFrames(entryMode) ||
    isExiting ||
    worldMapState !== WORLD_MAP_STATE_FREE_ROAM ||
    minimapMode === MINIMAP_MODE_LARGE
  )
}

const getDirectionMagnitude = (moveX: number, moveY: number) =>
  moveX !== 0 && moveY !== 0 ? DPAD_DIAGONAL_MAGNITUDE : DPAD_MAGNITUDE

const isCardButtonHeld = (padButtons: number) => (padButtons & WORLDMAP_PAD_BITS.card) !== 0

export const readOnFootInput = (controls: WorldmapControlsState, isIgnored: boolean): OnFootInput => {
  if (isIgnored) {
    return IDLE_INPUT
  }
  const { moveX, moveY, padButtons } = controls
  const isMoving = moveX !== 0 || moveY !== 0
  const magnitude = getDirectionMagnitude(moveX, moveY)
  return {
    isMoving,
    isNoSteering: !isMoving || isCardButtonHeld(padButtons),
    x: moveX * magnitude,
    z: moveY * magnitude,
  }
}
