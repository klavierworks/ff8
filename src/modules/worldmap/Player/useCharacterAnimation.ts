import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { MutableRefObject, useEffect, useMemo, useRef } from 'react'
import { AnimationAction, AnimationClip, Group } from 'three'

import { framesToSeconds, TARGET_FPS } from '../../../timing'
import {
  CharacterAnimationState,
  getClipFrameCount,
  getIdleSequence,
  stepCharacterAnimation,
} from './characterAnimationUtils'
import { CLIP_STAND } from './constants'
import { INITIAL_ROLL_STATE } from './idleRollUtils'
import { getMovementOutputs } from './movementState'

type AnimationActions = Record<string, AnimationAction | null>

const INITIAL_STATE: CharacterAnimationState = { clip: CLIP_STAND, frame: 0, roll: INITIAL_ROLL_STATE }

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

const showClipFrame = (
  actions: AnimationActions,
  animations: readonly AnimationClip[],
  previousClip: number | undefined,
  state: CharacterAnimationState,
) => {
  const action = getClipAction(actions, animations, state.clip)
  if (!action) {
    return
  }
  if (previousClip !== state.clip) {
    startClip(actions, animations, previousClip, action)
  }
  action.time = framesToSeconds(state.frame)
}

const useCharacterAnimation = (
  animations: AnimationClip[],
  animationGroupRef: MutableRefObject<Group | null>,
  onFootTag: number,
  shouldFreeze: () => boolean,
) => {
  const { actions } = useAnimations(animations, animationGroupRef)
  const frameCounts = useMemo(
    () => animations.map((clip) => getClipFrameCount(clip.duration, TARGET_FPS)),
    [animations],
  )
  const sequence = useMemo(() => getIdleSequence(onFootTag), [onFootTag])

  const stateRef = useRef<CharacterAnimationState>(INITIAL_STATE)
  const shownClipRef = useRef<number | undefined>(undefined)
  const lastTickRef = useRef(-1)

  useEffect(() => {
    showClipFrame(actions, animations, undefined, stateRef.current)
    shownClipRef.current = stateRef.current.clip
  }, [actions, animations])

  useFrame(() => {
    const { isMoving, tick } = getMovementOutputs()
    if (tick === lastTickRef.current) {
      return
    }
    lastTickRef.current = tick
    if (shouldFreeze()) {
      return
    }
    const next = stepCharacterAnimation(stateRef.current, isMoving, frameCounts, sequence)
    showClipFrame(actions, animations, shownClipRef.current, next)
    stateRef.current = next
    shownClipRef.current = next.clip
  })
}

export default useCharacterAnimation
