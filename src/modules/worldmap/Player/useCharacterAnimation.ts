import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { MutableRefObject, useEffect, useMemo, useRef } from 'react'
import { AnimationClip, Group } from 'three'

import { isChocobo } from '../vehicleClasses'
import useWorldmapStore from '../worldmapStore'
import {
  CharacterAnimationState,
  getIdleSequence,
  IdleSequence,
  stepCharacterAnimation,
} from './characterAnimationUtils'
import { getChocoboRiderState, updateChocoboRiderState } from './ChocoboRider/chocoboRiderState'
import { calculateClipFrameCounts, showClipFrame } from './clipPlaybackUtils'
import { CLIP_STAND } from './constants'
import { INITIAL_ROLL_STATE } from './idleRollUtils'
import { getMovementOutputs } from './movementState'
import { leaveRideClip, stepRiderAnimation } from './riderAnimationUtils'

const INITIAL_STATE: CharacterAnimationState = { clip: CLIP_STAND, frame: 0, roll: INITIAL_ROLL_STATE }

const readDismountSubframes = () => {
  const { dismount, dismountFrame } = getChocoboRiderState()
  return dismount ? dismountFrame : undefined
}

const stepAnimation = (
  state: CharacterAnimationState,
  isMoving: boolean,
  frameCounts: readonly number[],
  sequence: IdleSequence | undefined,
) => {
  if (!isChocobo(useWorldmapStore.getState().vehicleId)) {
    return stepCharacterAnimation(leaveRideClip(state), isMoving, frameCounts, sequence)
  }
  return stepRiderAnimation(state, { dismountSubframes: readDismountSubframes(), frameCounts, isMoving })
}

const publishRiderPose = ({ clip, frame }: CharacterAnimationState) => {
  if (isChocobo(useWorldmapStore.getState().vehicleId)) {
    updateChocoboRiderState({ riderPose: { clip, frame } })
  }
}

const useCharacterAnimation = (
  animations: AnimationClip[],
  animationGroupRef: MutableRefObject<Group | null>,
  onFootTag: number,
  shouldFreeze: () => boolean,
) => {
  const { actions } = useAnimations(animations, animationGroupRef)
  const frameCounts = useMemo(() => calculateClipFrameCounts(animations), [animations])
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
    const next = stepAnimation(stateRef.current, isMoving, frameCounts, sequence)
    publishRiderPose(next)
    showClipFrame(actions, animations, shownClipRef.current, next)
    stateRef.current = next
    shownClipRef.current = next.clip
  })
}

export default useCharacterAnimation
