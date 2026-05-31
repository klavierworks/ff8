import type { Howl } from 'howler'

import { clamp } from 'three/src/math/MathUtils.js'

export type Foot = 'left' | 'right'

export const getNextFoot = (previousFoot: Foot | undefined): Foot => (previousFoot === 'right' ? 'left' : 'right')

export const hasFootPlanted = (previousPhase: number, phase: number): boolean => {
  const hasCrossedMidpoint = previousPhase < 0.5 && phase >= 0.5
  const hasWrapped = phase < previousPhase
  return hasCrossedMidpoint || hasWrapped
}

const calculateFootstepVolume = (isWalking: boolean, distanceToCamera: number): number =>
  clamp(0.1, (isWalking ? 0.5 : 1) * (2 - distanceToCamera), 0.3)

export const triggerFootstep = ({
  distanceToCamera,
  foot,
  isWalking,
  leftSound,
  rightSound,
}: {
  distanceToCamera: number
  foot: Foot
  isWalking: boolean
  leftSound: Howl
  rightSound: Howl
}): void => {
  const sound = foot === 'left' ? leftSound : rightSound
  sound.seek(0)
  sound.volume(calculateFootstepVolume(isWalking, distanceToCamera))
  sound.play()
}
