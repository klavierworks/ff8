import { clamp } from 'three/src/math/MathUtils.js'

import {
  FOOTSTEP_PAN_MAX_SCREEN_X,
  FOOTSTEP_PAN_MIN_SCREEN_X,
  FOOTSTEP_PAN_SCREEN_X_DIVISOR,
  MAX_SFX_VOLUME,
  SFX_PAN_CENTRE,
} from '../../../../../constants/audio'
import { SCREEN_WIDTH } from '../../../../../constants/constants'
import { Foot } from '../FootstepController/FootstepController'

export const getNextFoot = (previousFoot: Foot | undefined): Foot => (previousFoot === 'first' ? 'second' : 'first')

export const hasFootPlanted = (previousPhase: number, phase: number): boolean => {
  const hasCrossedMidpoint = previousPhase < 0.5 && phase >= 0.5
  const hasWrapped = phase < previousPhase
  return hasCrossedMidpoint || hasWrapped
}

export const calculateFootstepVolume = (isWalking: boolean, distanceToCamera: number): number =>
  Math.max(0.1, (isWalking ? 0.5 : 1) * (2 - distanceToCamera)) * MAX_SFX_VOLUME

export const calculateFootstepPan = (normalisedScreenX: number): number => {
  const screenX = (normalisedScreenX * SCREEN_WIDTH) / 2
  const clampedScreenX = clamp(screenX, FOOTSTEP_PAN_MIN_SCREEN_X, FOOTSTEP_PAN_MAX_SCREEN_X)

  return clampedScreenX / FOOTSTEP_PAN_SCREEN_X_DIVISOR + SFX_PAN_CENTRE
}
