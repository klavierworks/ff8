import {
  FLIP_ACTIVE_FRAMES,
  FLIP_FRAMES,
  FLIP_SWAP_FRAME,
  PLACE_BOUNCE_FRAMES,
  PLACE_BOUNCE_HEIGHT,
} from '../../../../constants/cardGameLayout'
import { Side } from '../../types'

export type EntryBounce = {
  bobY: number
  isDone: boolean
}

export type FlipAxis = 'x' | 'y'

export type FlipPose = {
  isDone: boolean
  liftZ: number
  rotationX: number
  rotationY: number
  shouldSwapOwner: boolean
}

// Captures from the top/right edge tumble about X; from the bottom/left edge about Y.
export const flipAxisForSide = (side: Side | undefined): FlipAxis => (side === 'top' || side === 'right' ? 'x' : 'y')

// Ortho single-plane flip: rotate face → edge-on (invisible at 90°) → face, so the same texture
// never shows a mirrored back. The owner colour swaps at the edge-on midpoint.
export const calculateFlipPose = (frame: number, axis: FlipAxis): FlipPose => {
  const activeProgress = Math.min(1, frame / FLIP_ACTIVE_FRAMES)
  const half = FLIP_ACTIVE_FRAMES / 2
  const halfTurn = frame <= half ? frame / half : Math.max(0, (FLIP_ACTIVE_FRAMES - frame) / half)
  const angle = halfTurn * (Math.PI / 2)
  return {
    isDone: frame >= FLIP_FRAMES,
    liftZ: Math.sin(activeProgress * Math.PI) * 10,
    rotationX: axis === 'x' ? angle : 0,
    rotationY: axis === 'y' ? angle : 0,
    shouldSwapOwner: frame >= FLIP_SWAP_FRAME,
  }
}

export const calculateEntryBounce = (frame: number): EntryBounce => ({
  bobY: Math.sin((Math.min(PLACE_BOUNCE_FRAMES, frame) / PLACE_BOUNCE_FRAMES) * Math.PI) * PLACE_BOUNCE_HEIGHT,
  isDone: frame >= PLACE_BOUNCE_FRAMES,
})
