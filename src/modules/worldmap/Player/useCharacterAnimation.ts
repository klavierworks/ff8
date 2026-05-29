import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { MutableRefObject, useCallback, useRef } from 'react'
import { AnimationClip, Group, LoopOnce, LoopRepeat } from 'three'

import { TARGET_FPS } from '../../../timing'
import { checkIdleTrigger } from './idleAnimUtils'

const ANIM_STAND = 0
const ANIM_RUN = 1
const ANIM_IDLE_1 = 2

// The idle threshold advances by a fixed byte step each time the 8-bit step
// counter wraps; together with the permutation-table roll this staggers when
// the one-shot idle flourish fires (see ida.md).
const IDLE_THRESHOLD_STEP = 240
const STEP_COUNTER_BYTE_MASK = 0xff
const FRAME_SECONDS = 1 / TARGET_FPS

type EngineAnimId = typeof ANIM_IDLE_1 | typeof ANIM_RUN | typeof ANIM_STAND

const useCharacterAnimation = (
  animations: AnimationClip[],
  animationGroupRef: MutableRefObject<Group | null>,
  speedRef: MutableRefObject<number>,
) => {
  const { actions } = useAnimations(animations, animationGroupRef)

  const engineAnimIdRef = useRef<EngineAnimId>(ANIM_STAND)
  const isInitializedRef = useRef(false)
  const stepCounterRef = useRef(0)
  const stepThresholdRef = useRef(0)
  const frameAccumulatorRef = useRef(0)
  const idleElapsedRef = useRef(0)

  const startAnimation = useCallback(
    (animId: EngineAnimId) => {
      const previousClipName = animations[engineAnimIdRef.current]?.name
      if (previousClipName) {
        actions[previousClipName]?.stop()
      }
      engineAnimIdRef.current = animId
      const clipName = animations[animId]?.name
      if (!clipName) {
        return
      }
      const action = actions[clipName]
      if (!action) {
        return
      }
      if (animId === ANIM_IDLE_1) {
        action.loop = LoopOnce
        action.clampWhenFinished = true
      } else {
        action.loop = LoopRepeat
        action.clampWhenFinished = false
      }
      action.reset().play()
    },
    [actions, animations, engineAnimIdRef],
  )

  const advanceIdleTrigger = useCallback((delta: number): boolean => {
    frameAccumulatorRef.current += delta
    while (frameAccumulatorRef.current >= FRAME_SECONDS) {
      frameAccumulatorRef.current -= FRAME_SECONDS
      const nextStep = (stepCounterRef.current + 1) & STEP_COUNTER_BYTE_MASK
      stepCounterRef.current = nextStep
      if (nextStep === 0) {
        stepThresholdRef.current = (stepThresholdRef.current + IDLE_THRESHOLD_STEP) & STEP_COUNTER_BYTE_MASK
      }
      if (checkIdleTrigger(stepCounterRef.current, stepThresholdRef.current)) {
        return true
      }
    }
    return false
  }, [])

  const pauseIdleAtHalfway = useCallback(
    (delta: number) => {
      idleElapsedRef.current += delta
      const clipName = animations[ANIM_IDLE_1]?.name
      if (!clipName) {
        return
      }
      const action = actions[clipName]
      const halfDuration = (action?.getClip().duration ?? 0) / 2
      if (action && idleElapsedRef.current >= halfDuration) {
        action.paused = true
      }
    },
    [actions, animations],
  )

  useFrame((_, delta) => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      startAnimation(ANIM_STAND)
      return
    }

    const isMoving = speedRef.current > 0
    const currentAnimId = engineAnimIdRef.current

    if (isMoving) {
      if (currentAnimId !== ANIM_RUN) {
        startAnimation(ANIM_RUN)
      }
      return
    }

    if (currentAnimId === ANIM_RUN) {
      startAnimation(ANIM_STAND)
      return
    }

    if (currentAnimId === ANIM_STAND) {
      if (advanceIdleTrigger(delta)) {
        idleElapsedRef.current = 0
        startAnimation(ANIM_IDLE_1)
      }
      return
    }

    if (currentAnimId === ANIM_IDLE_1) {
      pauseIdleAtHalfway(delta)
    }
  })
}

export default useCharacterAnimation
