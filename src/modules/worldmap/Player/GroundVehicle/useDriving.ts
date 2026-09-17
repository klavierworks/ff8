import { useThree } from '@react-three/fiber'
import { Object3D, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { convertRadiansToCameraYaw } from '../../Camera/cameraUtils'
import { WORLDMAP_STATE } from '../../Scripts/state'
import { psxHeightToWorldY, worldYToPsxHeight } from '../../terrain'
import useScriptTick from '../../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import {
  calculateHeadingStep,
  calculateSpeedCap,
  DrivingCamera,
  readDrivingInput,
  stepVehicleVelocity,
  stepVehicleYaw,
} from '../drivingUtils'
import { getHeldSlideSet, GroundStep, resolveGroundStep, SlideSet } from '../groundStep'
import { setMovementOutputs } from '../movementState'
import { isPadInputIgnored } from '../onFootInput'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection, wrapPsxAngle } from '../playerAngles'
import { getGroundVehicleState, GroundVehicleState, setGroundVehicleState } from './groundVehicleState'
import { getGroundVehicle, GroundVehicle, isStepBlockedByEntity } from './groundVehicleUtils'

const readDrivingCamera = (): DrivingCamera => {
  const { camera, cameraModeIndex } = useWorldmapStore.getState()
  return { cameraModeIndex, cameraYaw: convertRadiansToCameraYaw(camera.yawRadians) }
}

const readHeading = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

const updateFieldDirection = (heading: number) => {
  const fieldDirection = convertHeadingToFieldDirection(heading)
  if (fieldDirection !== useGlobalStore.getState().fieldDirection) {
    useGlobalStore.setState({ fieldDirection })
  }
}

const isStepClear = (vehicle: GroundVehicle, step: GroundStep | undefined, altitude: number): step is GroundStep =>
  step !== undefined && !isStepBlockedByEntity(vehicle, step.x, step.z, altitude)

const commitStep = (
  position: Vector3,
  step: GroundStep,
  height: number,
  memory: GroundVehicleState,
  velocity: number,
) => {
  position.set(step.x, psxHeightToWorldY(height), step.z)
  WORLDMAP_STATE.locationTriangle = step.triangle
  setGroundVehicleState({
    ...memory,
    blockedTicks: 0,
    preferredSet: step.set,
    slideAnglePsx: step.slideAnglePsx,
    velocity,
  })
}

const recordBlockedStep = (memory: GroundVehicleState, preferredSet: SlideSet, velocity: number) => {
  setGroundVehicleState({ ...memory, blockedTicks: memory.blockedTicks + 1, preferredSet, slideAnglePsx: 0, velocity })
}

const runDrivingTick = (scene: Object3D, position: Vector3, vehicle: GroundVehicle, tick: number) => {
  const { padButtons } = useWorldmapStore.getState().controls
  const input = readDrivingInput(padButtons, isPadInputIgnored(tick))
  const camera = readDrivingCamera()
  const memory = getGroundVehicleState()
  const yaw = stepVehicleYaw(readHeading(), input.turn, camera, vehicle.driving)

  const velocity = stepVehicleVelocity(
    memory.velocity,
    input.throttle,
    calculateSpeedCap(yaw, camera, vehicle.driving),
    vehicle.driving,
  )
  const preferredSet = getHeldSlideSet(padButtons, memory.preferredSet)
  const currentPsxY = worldYToPsxHeight(position.y)
  const step = resolveGroundStep(scene, {
    blockedTicks: memory.blockedTicks,
    currentGroundType: WORLDMAP_STATE.locationTriangle?.groundType,
    currentPsxY,
    preferredSet,
    profile: vehicle.ground,
    velocity: calculateHeadingStep(velocity, yaw),
    x: position.x,
    z: position.z,
  })
  const height = step ? vehicle.stepHeight(currentPsxY, step.triangle) : currentPsxY

  if (isStepClear(vehicle, step, height)) {
    commitStep(position, step, height, memory, velocity)
  } else {
    recordBlockedStep(memory, preferredSet, velocity)
  }

  updateFieldDirection(wrapPsxAngle(yaw + (memory.slideAnglePsx >> vehicle.slideDriftShift)))
  setMovementOutputs({ headingPsx: readHeading(), isMoving: velocity !== 0, isNoSteering: input.turn === 0, tick })
}

const useDriving = () => {
  const scene = useThree((state) => state.scene)

  useScriptTick(
    (tick) => {
      const { vehicleId, worldMapState } = useWorldmapStore.getState()
      const position = useGlobalStore.getState().characterPosition
      const vehicle = getGroundVehicle(vehicleId)
      if (!position || !vehicle || worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
        return
      }
      runDrivingTick(scene, position, vehicle, tick)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useDriving
