import { useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Object3D, Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { WORLDMAP_STATE } from '../Scripts/state'
import { getOnFootPsxHeight, psxHeightToWorldY, worldYToPsxHeight } from '../terrain'
import useScriptTick from '../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from './constants'
import { setMovementOutputs } from './movementState'
import { isPadInputIgnored, OnFootInput, readOnFootInput } from './onFootInput'
import { calculateOnFootVelocity, calculateTargetHeadingPsx, OnFootVelocity, stepOnFootHeading } from './onFootMotion'
import { getPreferredSlideSet, OnFootStep, resolveOnFootStep, SlideSet } from './onFootStep'

type MovementMemory = {
  blockedTicks: number
  groundType: number | undefined
  lastSlideAnglePsx: number
  padButtons: number
  preferredSet: SlideSet
}

const INITIAL_MEMORY: MovementMemory = {
  blockedTicks: 0,
  groundType: undefined,
  lastSlideAnglePsx: 0,
  padButtons: 0,
  preferredSet: 0,
}

const readInputForTick = (tick: number) =>
  readOnFootInput(useWorldmapStore.getState().controls, isPadInputIgnored(tick))

const calculateHeading = (
  currentPsx: number,
  input: OnFootInput,
  velocity: OnFootVelocity,
  lastSlideAnglePsx: number,
) => {
  if (!input.isMoving) {
    return { headingPsx: currentPsx, isTurnClamped: false }
  }
  return stepOnFootHeading(currentPsx, calculateTargetHeadingPsx(velocity, lastSlideAnglePsx))
}

const updateCollisionMemory = (
  memory: MovementMemory,
  preferredSet: SlideSet,
  step: OnFootStep | undefined,
): MovementMemory => {
  if (!step) {
    return { ...memory, blockedTicks: memory.blockedTicks + 1, lastSlideAnglePsx: 0, preferredSet }
  }
  return {
    ...memory,
    blockedTicks: 0,
    groundType: step.triangle.groundType,
    lastSlideAnglePsx: step.slideAnglePsx,
    preferredSet: step.set,
  }
}

const applyStep = (position: Vector3, step: OnFootStep) => {
  if (useWorldmapStore.getState().worldMapState === WORLD_MAP_STATE_FREE_ROAM) {
    position.set(step.x, psxHeightToWorldY(getOnFootPsxHeight(step.triangle)), step.z)
  }
  WORLDMAP_STATE.locationTriangle = step.triangle
}

const runMovementTick = (scene: Object3D, memory: MovementMemory, tick: number): MovementMemory => {
  const { characterPosition: position, fieldDirection } = useGlobalStore.getState()
  const { camera, controls } = useWorldmapStore.getState()
  if (!position) {
    return memory
  }

  const input = readInputForTick(tick)
  const velocity = calculateOnFootVelocity(input, camera.yawRadians)
  const heading = calculateHeading(fieldDirection, input, velocity, memory.lastSlideAnglePsx)
  const preferredSet = getPreferredSlideSet(controls.padButtons, memory.padButtons, memory.preferredSet)

  const step = resolveOnFootStep(scene, {
    blockedTicks: memory.blockedTicks,
    currentGroundType: memory.groundType,
    currentPsxY: worldYToPsxHeight(position.y),
    preferredSet,
    velocity,
    x: position.x,
    z: position.z,
  })
  if (step) {
    applyStep(position, step)
  }

  if (heading.headingPsx !== fieldDirection) {
    useGlobalStore.setState({ fieldDirection: heading.headingPsx })
  }
  setMovementOutputs({
    headingPsx: heading.headingPsx,
    isMoving: input.isMoving,
    isNoSteering: input.isNoSteering || heading.isTurnClamped,
    tick,
  })

  return { ...updateCollisionMemory(memory, preferredSet, step), padButtons: controls.padButtons }
}

const useMovement = () => {
  const scene = useThree((state) => state.scene)
  const memoryRef = useRef(INITIAL_MEMORY)

  useScriptTick(
    (tick) => {
      memoryRef.current = runMovementTick(scene, memoryRef.current, tick)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useMovement
