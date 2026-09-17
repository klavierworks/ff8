import { CharacterAnimationState } from './characterAnimationUtils'
import {
  ANIMATION_SUBFRAMES_PER_KEYFRAME,
  CLIP_RIDE_DISMOUNT,
  CLIP_RIDE_FLOURISH,
  CLIP_RIDE_RUN,
  CLIP_RIDE_STAND,
  CLIP_STAND,
  RIDE_FLOURISH_ROLL_MASK,
} from './constants'
import { rollRandom } from './idleRollUtils'

type RiderStepRequest = {
  dismountSubframes: number | undefined
  frameCounts: readonly number[]
  isMoving: boolean
}

const isRideClip = (clip: number) => clip >= CLIP_RIDE_DISMOUNT && clip <= CLIP_RIDE_FLOURISH

export const leaveRideClip = (state: CharacterAnimationState): CharacterAnimationState =>
  isRideClip(state.clip) ? { ...state, clip: CLIP_STAND, frame: 0 } : state

const enterRideClip = (state: CharacterAnimationState): CharacterAnimationState =>
  isRideClip(state.clip) ? state : { ...state, clip: CLIP_RIDE_STAND, frame: 0 }

const chooseRideClip = (state: CharacterAnimationState, isMoving: boolean) => {
  if (isMoving) {
    return { clip: CLIP_RIDE_RUN, roll: state.roll }
  }
  if (state.clip === CLIP_RIDE_RUN) {
    return { clip: CLIP_RIDE_STAND, roll: state.roll }
  }
  if (state.clip !== CLIP_RIDE_STAND) {
    return { clip: state.clip, roll: state.roll }
  }
  const { state: roll, value } = rollRandom(state.roll)
  return { clip: (value & RIDE_FLOURISH_ROLL_MASK) === 0 ? CLIP_RIDE_FLOURISH : CLIP_RIDE_STAND, roll }
}

const getClipEndClip = (clip: number) => {
  if (clip === CLIP_RIDE_FLOURISH) {
    return CLIP_RIDE_STAND
  }
  return clip === CLIP_RIDE_DISMOUNT ? CLIP_STAND : clip
}

const advanceRideFrame = (state: CharacterAnimationState, frameCounts: readonly number[]) => {
  const nextFrame = state.frame + 1
  if (nextFrame < (frameCounts[state.clip] ?? 1)) {
    return { ...state, frame: nextFrame }
  }
  return { ...state, clip: getClipEndClip(state.clip), frame: 0 }
}

export const stepRiderAnimation = (
  state: CharacterAnimationState,
  { dismountSubframes, frameCounts, isMoving }: RiderStepRequest,
): CharacterAnimationState => {
  const current = enterRideClip(state)
  if (dismountSubframes !== undefined) {
    return { ...current, clip: CLIP_RIDE_DISMOUNT, frame: dismountSubframes / ANIMATION_SUBFRAMES_PER_KEYFRAME }
  }
  const { clip, roll } = chooseRideClip(current, isMoving)
  if (clip !== current.clip) {
    return { clip, frame: 0, roll }
  }
  return advanceRideFrame({ ...current, roll }, frameCounts)
}
