import {
  SPINNER_TOSS_ARC_FRAMES,
  SPINNER_TOSS_FRAMES,
  SPINNER_TOSS_HOLD_FRAMES,
  SPINNER_WINNER_OFFSET_Y,
  SPINNER_WOBBLE_FRAMES,
} from '../../../../constants/cardGameLayout'
import { CardOwner } from '../../types'

export type SpinnerPose = {
  isTossDone: boolean
  offsetY: number
  rotationX: number
  rotationY: number
}

const TURN = Math.PI * 2

const winnerOffsetY = (winner: CardOwner): number =>
  winner === 'player' ? SPINNER_WINNER_OFFSET_Y : -SPINNER_WINNER_OFFSET_Y

// Toss: an upward sine arc (Y tumble) + a ramping X spin, a hold at the apex, then a descent that
// eases the screen position toward the winner.
const calculateTossPose = (frame: number, winner: CardOwner): SpinnerPose => {
  const targetOffsetY = winnerOffsetY(winner)
  const xSpins = 2.5
  const rotationX = (frame / SPINNER_TOSS_ARC_FRAMES) * TURN * xSpins
  const tumbleDirection = winner === 'player' ? 1 : -1
  const rotationY = Math.sin((frame / SPINNER_TOSS_ARC_FRAMES) * Math.PI) * TURN * tumbleDirection

  if (frame < SPINNER_TOSS_ARC_FRAMES) {
    const arc = Math.sin((frame / SPINNER_TOSS_ARC_FRAMES) * Math.PI)
    return { isTossDone: false, offsetY: -arc * 48, rotationX, rotationY }
  }

  const holdEnd = SPINNER_TOSS_ARC_FRAMES + SPINNER_TOSS_HOLD_FRAMES
  if (frame < holdEnd) {
    return { isTossDone: false, offsetY: -48, rotationX, rotationY }
  }

  const descendProgress = Math.min(1, (frame - holdEnd) / (SPINNER_TOSS_FRAMES - holdEnd))
  const offsetY = -48 + (targetOffsetY + 48) * descendProgress
  return { isTossDone: false, offsetY, rotationX, rotationY }
}

// Rest: a gentle continuous sine wobble once the toss settles.
const calculateWobblePose = (frame: number, winner: CardOwner): SpinnerPose => {
  const restFrame = frame - SPINNER_TOSS_FRAMES
  const phase = (restFrame % SPINNER_WOBBLE_FRAMES) / SPINNER_WOBBLE_FRAMES
  const wobble = Math.sin(phase * TURN)
  return {
    isTossDone: true,
    offsetY: winnerOffsetY(winner) + wobble * 1.5,
    rotationX: 0,
    rotationY: wobble * 0.25,
  }
}

export const calculateSpinnerPose = (frame: number, winner: CardOwner): SpinnerPose => {
  if (frame < SPINNER_TOSS_FRAMES) {
    return calculateTossPose(frame, winner)
  }
  return calculateWobblePose(frame, winner)
}
