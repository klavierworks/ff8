import { AnimationAction, AnimationClip } from 'three'

import { framesToSeconds, TARGET_FPS } from '../../../timing'
import { getClipFrameCount } from './characterAnimationUtils'

export type AnimationActions = Record<string, AnimationAction | null>

export type ClipPose = {
  clip: number
  frame: number
}

const getClipAction = (actions: AnimationActions, animations: readonly AnimationClip[], clip: number) => {
  const clipName = animations[clip]?.name
  return clipName ? actions[clipName] : null
}

const startClip = (
  actions: AnimationActions,
  animations: readonly AnimationClip[],
  previousClip: number | undefined,
  action: AnimationAction,
) => {
  if (previousClip !== undefined) {
    getClipAction(actions, animations, previousClip)?.stop()
  }
  action.reset().play()
  action.paused = true
}

export const showClipFrame = (
  actions: AnimationActions,
  animations: readonly AnimationClip[],
  previousClip: number | undefined,
  pose: ClipPose,
) => {
  const action = getClipAction(actions, animations, pose.clip)
  if (!action) {
    return
  }
  if (previousClip !== pose.clip) {
    startClip(actions, animations, previousClip, action)
  }
  action.time = framesToSeconds(pose.frame)
}

export const calculateClipFrameCounts = (animations: readonly AnimationClip[]) =>
  animations.map((clip) => getClipFrameCount(clip.duration, TARGET_FPS))
