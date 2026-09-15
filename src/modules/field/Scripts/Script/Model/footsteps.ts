import { clamp } from 'three/src/math/MathUtils.js'

import {
  FOOTSTEP_ATTENUATION_MAX,
  FOOTSTEP_ATTENUATION_MIN,
  FOOTSTEP_ATTENUATION_PER_WORLD_UNIT,
  FOOTSTEP_PAN_MAX_SCREEN_X,
  FOOTSTEP_PAN_MIN_SCREEN_X,
  FOOTSTEP_PAN_SCREEN_X_DIVISOR,
  FOOTSTEP_VOLUME_MAX,
  SFX_PAN_CENTRE,
} from '../../../../../constants/audio'
import { SCREEN_WIDTH } from '../../../../../constants/constants'
import { Foot } from '../FootstepController/FootstepController'

const CYCLE_MIDPOINT = 0.5

const isBeforeCycleMidpoint = (phase: number) => phase < CYCLE_MIDPOINT

// A phase that moves by more than half a cycle in one frame has wrapped rather
// than stepped, which is what separates the two crossings whichever way the
// animation is running.
const hasCrossedCycleStart = (previousPhase: number, phase: number) => Math.abs(phase - previousPhase) > CYCLE_MIDPOINT

// Each foot belongs to one of the animation's two half-cycle crossings.
export const getPlantedFoot = (previousPhase: number, phase: number): Foot | undefined => {
  if (hasCrossedCycleStart(previousPhase, phase)) {
    return 'first'
  }

  if (isBeforeCycleMidpoint(previousPhase) !== isBeforeCycleMidpoint(phase)) {
    return 'second'
  }

  return undefined
}

export const calculateFootstepVolume = (viewDepth: number): number =>
  FOOTSTEP_VOLUME_MAX -
  clamp(viewDepth * FOOTSTEP_ATTENUATION_PER_WORLD_UNIT, FOOTSTEP_ATTENUATION_MIN, FOOTSTEP_ATTENUATION_MAX)

export const calculateFootstepPan = (normalisedScreenX: number): number => {
  const screenX = (normalisedScreenX * SCREEN_WIDTH) / 2
  const clampedScreenX = clamp(screenX, FOOTSTEP_PAN_MIN_SCREEN_X, FOOTSTEP_PAN_MAX_SCREEN_X)

  return clampedScreenX / FOOTSTEP_PAN_SCREEN_X_DIVISOR + SFX_PAN_CENTRE
}
