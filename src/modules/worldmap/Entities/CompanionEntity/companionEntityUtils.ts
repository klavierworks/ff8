import {
  CHICOBO_CLIP_FLOURISH,
  CHICOBO_CLIP_RUN,
  CHICOBO_CLIP_STAND,
  CHICOBO_ENTITY_TYPE,
  CHICOBO_IDLE_ROLL_MASK,
  CHICOBO_SUBFRAME_STEP,
  CHOCOBO_CLIP_DISMOUNT,
  CHOCOBO_CLIP_FLOURISH,
  CHOCOBO_CLIP_RUN,
  CHOCOBO_CLIP_STAND,
} from '../../../../constants/worldmapEntities'
import { getChocoboRiderState } from '../../Player/ChocoboRider/chocoboRiderState'
import { CompanionTrail, getChicoboEntry } from '../../Player/ChocoboRider/companionTrailUtils'
import { ClipPose } from '../../Player/clipPlaybackUtils'
import {
  ANIMATION_SUBFRAMES_PER_KEYFRAME,
  CLIP_RIDE_DISMOUNT,
  CLIP_RIDE_FLOURISH,
  CLIP_RIDE_RUN,
  CLIP_RIDE_STAND,
} from '../../Player/constants'
import { rollRandom, RollState } from '../../Player/idleRollUtils'
import { ShipPose } from '../../Player/shipPose'
import { WORLDMAP_STATE } from '../../Scripts/state'
import { isGroundTypeCanopy } from '../../terrain'
import { isChocobo } from '../../vehicleClasses'
import useWorldmapStore, { WORLD_MAP_STATE_CHOCOBO_DISMOUNT } from '../../worldmapStore'

export type CompanionAnimation = ClipPose & {
  roll: RollState
}

export type CompanionPresence = {
  heading: number
  isVisible: boolean
  pose: ShipPose | undefined
}

const CHOCOBO_CLIPS_BY_RIDER_CLIP: Partial<Record<number, number>> = {
  [CLIP_RIDE_DISMOUNT]: CHOCOBO_CLIP_DISMOUNT,
  [CLIP_RIDE_FLOURISH]: CHOCOBO_CLIP_FLOURISH,
  [CLIP_RIDE_RUN]: CHOCOBO_CLIP_RUN,
  [CLIP_RIDE_STAND]: CHOCOBO_CLIP_STAND,
}

const HIDDEN_PRESENCE: CompanionPresence = { heading: 0, isVisible: false, pose: undefined }

const isFollowingPlayer = () =>
  isChocobo(useWorldmapStore.getState().vehicleId) || getChocoboRiderState().runOff.phase !== 'idle'

const isDismounting = () => useWorldmapStore.getState().worldMapState === WORLD_MAP_STATE_CHOCOBO_DISMOUNT

const getChocoboPresence = (playerHeading: number): CompanionPresence => {
  const { runOff } = getChocoboRiderState()
  if (!isFollowingPlayer()) {
    return HIDDEN_PRESENCE
  }
  if (runOff.phase === 'idle') {
    return {
      heading: playerHeading,
      isVisible: !isGroundTypeCanopy(WORLDMAP_STATE.locationTriangle?.groundType),
      pose: undefined,
    }
  }
  const isHiddenWhileDismounting = isDismounting() && runOff.phase === 'finished'
  return {
    heading: runOff.pose.heading,
    isVisible: !isHiddenWhileDismounting && !isGroundTypeCanopy(runOff.pose.triangle?.groundType),
    pose: runOff.pose,
  }
}

const isChicoboHiddenByRunOff = () => {
  const { runOff } = getChocoboRiderState()
  return runOff.phase === 'finished' || (runOff.phase === 'running' && runOff.trailMark === undefined)
}

const getChicoboPresence = (trail: CompanionTrail | null): CompanionPresence => {
  if (!trail || !isFollowingPlayer() || isChicoboHiddenByRunOff()) {
    return HIDDEN_PRESENCE
  }
  const entry = getChicoboEntry(trail)
  return { heading: entry.heading, isVisible: !entry.isOnCanopy, pose: entry }
}

export const getCompanionPresence = (typeCode: number, playerHeading: number) =>
  typeCode === CHICOBO_ENTITY_TYPE
    ? getChicoboPresence(getChocoboRiderState().trail)
    : getChocoboPresence(playerHeading)

const getFrameCount = (frameCounts: readonly number[], clip: number) => frameCounts[clip] ?? 1

const loopFrame = (frame: number, frameCounts: readonly number[], clip: number) =>
  (frame + 1) % getFrameCount(frameCounts, clip)

const changeClip = (animation: CompanionAnimation, clip: number, frame: number): CompanionAnimation => ({
  ...animation,
  clip,
  frame: clip === animation.clip ? frame : 0,
})

const stepDismountingChocobo = (animation: CompanionAnimation, frameCounts: readonly number[]) => {
  const { dismountFrame, riderPose } = getChocoboRiderState()
  if (riderPose.clip !== CLIP_RIDE_DISMOUNT) {
    return changeClip(animation, CHOCOBO_CLIP_STAND, animation.frame)
  }
  const currentLength = getFrameCount(frameCounts, animation.clip) * ANIMATION_SUBFRAMES_PER_KEYFRAME
  if (dismountFrame >= currentLength) {
    return changeClip(animation, CHOCOBO_CLIP_RUN, loopFrame(animation.frame, frameCounts, animation.clip))
  }
  return changeClip(animation, CHOCOBO_CLIP_DISMOUNT, dismountFrame / ANIMATION_SUBFRAMES_PER_KEYFRAME)
}

const stepChocoboAnimation = (animation: CompanionAnimation, frameCounts: readonly number[]) => {
  if (isDismounting()) {
    return stepDismountingChocobo(animation, frameCounts)
  }
  if (getChocoboRiderState().runOff.phase !== 'idle') {
    return changeClip(animation, CHOCOBO_CLIP_RUN, loopFrame(animation.frame, frameCounts, animation.clip))
  }
  const { riderPose } = getChocoboRiderState()
  return {
    ...animation,
    clip: CHOCOBO_CLIPS_BY_RIDER_CLIP[riderPose.clip] ?? CHOCOBO_CLIP_STAND,
    frame: riderPose.frame,
  }
}

const CHICOBO_KEYFRAME_STEP = CHICOBO_SUBFRAME_STEP / ANIMATION_SUBFRAMES_PER_KEYFRAME

const advanceChicoboFrame = (animation: CompanionAnimation, frameCounts: readonly number[]) => {
  const nextFrame = animation.frame + CHICOBO_KEYFRAME_STEP
  const frameCount = getFrameCount(frameCounts, animation.clip)
  if (nextFrame < frameCount) {
    return { ...animation, frame: nextFrame }
  }
  if (animation.clip === CHICOBO_CLIP_FLOURISH) {
    return { ...animation, clip: CHICOBO_CLIP_STAND, frame: 0 }
  }
  return { ...animation, frame: nextFrame % frameCount }
}

const stepIdleChicobo = (animation: CompanionAnimation, frameCounts: readonly number[]) => {
  if (animation.clip === CHICOBO_CLIP_RUN) {
    return { ...animation, clip: CHICOBO_CLIP_STAND, frame: 0 }
  }
  if (animation.clip !== CHICOBO_CLIP_STAND) {
    return advanceChicoboFrame(animation, frameCounts)
  }
  const { state: roll, value } = rollRandom(animation.roll)
  if ((value & CHICOBO_IDLE_ROLL_MASK) === 0) {
    return { clip: CHICOBO_CLIP_FLOURISH, frame: 0, roll }
  }
  return advanceChicoboFrame({ ...animation, roll }, frameCounts)
}

const stepChicoboAnimation = (animation: CompanionAnimation, frameCounts: readonly number[]) => {
  if (!getChocoboRiderState().trail?.isAdvancing) {
    return stepIdleChicobo(animation, frameCounts)
  }
  if (animation.clip !== CHICOBO_CLIP_RUN) {
    return { ...animation, clip: CHICOBO_CLIP_RUN, frame: 0 }
  }
  return advanceChicoboFrame(animation, frameCounts)
}

export const stepCompanionAnimation = (
  typeCode: number,
  animation: CompanionAnimation,
  frameCounts: readonly number[],
) =>
  typeCode === CHICOBO_ENTITY_TYPE
    ? stepChicoboAnimation(animation, frameCounts)
    : stepChocoboAnimation(animation, frameCounts)
