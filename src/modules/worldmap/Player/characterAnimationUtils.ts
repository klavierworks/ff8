import {
  CLIP_FLOURISH,
  CLIP_FLOURISH_FOLLOW_UP,
  CLIP_RUN,
  CLIP_STAND,
  FLOURISH_HOLD_ROLL_MASK,
  IDLE_START_ROLL_MASK,
  SQUALL_MAX_ON_FOOT_TAG,
} from './constants'
import { rollRandom, RollState } from './idleRollUtils'

export type CharacterAnimationState = {
  clip: number
  frame: number
  roll: RollState
}

type ClipEnd = {
  clip: number
  frameCount: number
  roll: RollState
}

type IdleSequence = {
  getClipEndState: (end: ClipEnd) => CharacterAnimationState
  getFlourishStart: (roll: RollState) => CharacterAnimationState
}

const createStandState = (roll: RollState) => ({ clip: CLIP_STAND, frame: 0, roll })

const SQUALL_IDLE_SEQUENCE: IdleSequence = {
  getClipEndState: ({ clip, frameCount, roll }) => {
    if (clip === CLIP_FLOURISH_FOLLOW_UP) {
      return createStandState(roll)
    }
    const { state, value } = rollRandom(roll)
    if ((value & FLOURISH_HOLD_ROLL_MASK) !== 0) {
      return { clip, frame: frameCount - 1, roll: state }
    }
    return { clip: CLIP_FLOURISH_FOLLOW_UP, frame: 0, roll: state }
  },
  getFlourishStart: (roll) => ({ clip: CLIP_FLOURISH, frame: 0, roll }),
}

export const getIdleSequence = (onFootTag: number): IdleSequence | undefined =>
  onFootTag <= SQUALL_MAX_ON_FOOT_TAG ? SQUALL_IDLE_SEQUENCE : undefined

export const getClipFrameCount = (durationSeconds: number, framesPerSecond: number) =>
  Math.round(durationSeconds * framesPerSecond) + 1

const getFrameCount = (frameCounts: readonly number[], clip: number) => frameCounts[clip] ?? 1

const stepRun = (state: CharacterAnimationState, frameCounts: readonly number[]) => {
  if (state.clip !== CLIP_RUN) {
    return { ...state, clip: CLIP_RUN, frame: 0 }
  }
  return { ...state, frame: (state.frame + 1) % getFrameCount(frameCounts, CLIP_RUN) }
}

const stepStand = (state: CharacterAnimationState, sequence: IdleSequence | undefined) => {
  const { state: roll, value } = rollRandom(state.roll)
  if (!sequence || (value & IDLE_START_ROLL_MASK) !== 0) {
    return { ...state, roll }
  }
  return sequence.getFlourishStart(roll)
}

const stepFlourish = (
  state: CharacterAnimationState,
  frameCounts: readonly number[],
  sequence: IdleSequence | undefined,
) => {
  const frameCount = getFrameCount(frameCounts, state.clip)
  const nextFrame = state.frame + 1
  if (nextFrame < frameCount) {
    return { ...state, frame: nextFrame }
  }
  if (!sequence) {
    return createStandState(state.roll)
  }
  return sequence.getClipEndState({ clip: state.clip, frameCount, roll: state.roll })
}

export const stepCharacterAnimation = (
  state: CharacterAnimationState,
  isMoving: boolean,
  frameCounts: readonly number[],
  sequence: IdleSequence | undefined,
) => {
  if (isMoving) {
    return stepRun(state, frameCounts)
  }
  if (state.clip === CLIP_RUN) {
    return createStandState(state.roll)
  }
  if (state.clip === CLIP_STAND) {
    return stepStand(state, sequence)
  }
  return stepFlourish(state, frameCounts, sequence)
}
