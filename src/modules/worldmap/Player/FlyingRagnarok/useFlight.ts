import { useThree } from '@react-three/fiber'
import { Object3D, Vector3 } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../../constants/controls'
import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { RAGNAROK_DRIVING } from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { convertRadiansToCameraYaw } from '../../Camera/cameraUtils'
import { getPadPresses } from '../../Controls/padPresses'
import { WORLDMAP_STATE } from '../../Scripts/state'
import useScriptTick from '../../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_AUTOPILOT, WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import {
  calculateHeadingStep,
  calculateSpeedCap,
  DrivingCamera,
  readDrivingInput,
  stepVehicleVelocity,
  stepVehicleYaw,
} from '../drivingUtils'
import { isPadInputIgnored } from '../onFootInput'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection } from '../playerAngles'
import {
  findTopTriangle,
  getTriangleAltitude,
  readShipPose,
  ShipPose,
  wrapMapX,
  wrapMapZ,
  writeShipPose,
} from '../shipPose'
import { calculateAutopilotCommand, calculateAutopilotSpeedCap } from './autopilotUtils'
import { isShipBlockedByEntity } from './boardingUtils'
import { clampShipAltitude, stepShipAltitude, stepShipBank } from './flightUtils'
import { AutopilotTarget, getAutopilot, getRagnarokOutputs, setAutopilot, setRagnarokOutputs } from './ragnarokState'

type FlightStep = {
  altitudeInput: number
  canBeBlocked: boolean
  shipYaw: number
  turn: number
  velocity: number
}

const readInputForTick = (tick: number) =>
  readDrivingInput(useWorldmapStore.getState().controls.padButtons, isPadInputIgnored(tick))

const readFlightCamera = (): DrivingCamera => {
  const { camera, cameraModeIndex } = useWorldmapStore.getState()
  return { cameraModeIndex, cameraYaw: convertRadiansToCameraYaw(camera.yawRadians) }
}

const readShipYaw = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

const isCancelPressed = (tick: number) => (getPadPresses(tick) & WORLDMAP_PAD_BITS.cancel) !== 0

const calculateTargetPose = (pose: ShipPose, shipYaw: number, velocity: number, altitudeInput: number): ShipPose => {
  const step = calculateHeadingStep(velocity, shipYaw)
  return {
    altitude: stepShipAltitude(pose.altitude, altitudeInput),
    x: wrapMapX(pose.x + step.x),
    z: wrapMapZ(pose.z + step.z),
  }
}

const settleOnTerrain = (scene: Object3D, target: ShipPose): ShipPose => {
  const ground = findTopTriangle(scene, target.x, target.z)
  WORLDMAP_STATE.locationTriangle = ground
  return { ...target, altitude: clampShipAltitude(target.altitude, ground && getTriangleAltitude(ground)) }
}

const moveShip = (scene: Object3D, position: Vector3, step: FlightStep) => {
  const pose = readShipPose(position)
  const target = calculateTargetPose(pose, step.shipYaw, step.velocity, step.altitudeInput)
  if (step.canBeBlocked && isShipBlockedByEntity(target)) {
    writeShipPose(position, pose)
    return 0
  }
  writeShipPose(position, settleOnTerrain(scene, target))
  return step.velocity
}

const updateFieldDirection = (shipYaw: number) => {
  const fieldDirection = convertHeadingToFieldDirection(shipYaw)
  if (fieldDirection !== useGlobalStore.getState().fieldDirection) {
    useGlobalStore.setState({ fieldDirection })
  }
}

const applyFlightStep = (scene: Object3D, position: Vector3, step: FlightStep) => {
  const outputs = getRagnarokOutputs()
  const bank = stepShipBank(outputs.bank, step.turn)
  const velocity = moveShip(scene, position, step)
  setRagnarokOutputs({ ...outputs, bank, velocity })
  updateFieldDirection(step.shipYaw)
}

const endAutopilot = () => {
  setAutopilot(null)
  useWorldmapStore.setState({ worldMapState: WORLD_MAP_STATE_FREE_ROAM })
}

const runFreeFlightTick = (scene: Object3D, position: Vector3, tick: number) => {
  const input = readInputForTick(tick)
  const camera = readFlightCamera()
  const shipYaw = stepVehicleYaw(readShipYaw(), input.turn, camera, RAGNAROK_DRIVING)
  const speedCap = calculateSpeedCap(shipYaw, camera, RAGNAROK_DRIVING)
  const velocity = stepVehicleVelocity(getRagnarokOutputs().velocity, input.throttle, speedCap, RAGNAROK_DRIVING)
  applyFlightStep(scene, position, {
    altitudeInput: input.altitude,
    canBeBlocked: true,
    shipYaw,
    turn: input.turn,
    velocity,
  })
}

const runAutopilotTick = (scene: Object3D, position: Vector3, tick: number, target: AutopilotTarget) => {
  const pose = readShipPose(position)
  const currentYaw = readShipYaw()
  const command = calculateAutopilotCommand({
    isCancelPressed: isCancelPressed(tick),
    pose,
    shipYaw: currentYaw,
    target,
  })
  const { input } = command
  const shipYaw = stepVehicleYaw(currentYaw, input.turn, readFlightCamera(), RAGNAROK_DRIVING)
  const speedCap = calculateAutopilotSpeedCap(command, shipYaw)
  const velocity = stepVehicleVelocity(getRagnarokOutputs().velocity, input.throttle, speedCap, RAGNAROK_DRIVING)
  const isEnding = command.isStopRequested && !isShipBlockedByEntity(pose)
  if (isEnding) {
    endAutopilot()
  }
  applyFlightStep(scene, position, {
    altitudeInput: input.altitude,
    canBeBlocked: isEnding,
    shipYaw,
    turn: input.turn,
    velocity,
  })
}

const runHeldFlightTick = (tick: number) => {
  const outputs = getRagnarokOutputs()
  setRagnarokOutputs({ ...outputs, bank: stepShipBank(outputs.bank, readInputForTick(tick).turn) })
}

const runFlightTick = (scene: Object3D, position: Vector3, tick: number) => {
  const { worldMapState } = useWorldmapStore.getState()
  if (worldMapState === WORLD_MAP_STATE_FREE_ROAM) {
    runFreeFlightTick(scene, position, tick)
    return
  }
  if (worldMapState !== WORLD_MAP_STATE_AUTOPILOT) {
    runHeldFlightTick(tick)
    return
  }
  const target = getAutopilot()
  if (!target) {
    endAutopilot()
    return
  }
  runAutopilotTick(scene, position, tick, target)
}

const useFlight = () => {
  const scene = useThree((state) => state.scene)

  useScriptTick(
    (tick) => {
      const position = useGlobalStore.getState().characterPosition
      if (!position || useWorldmapStore.getState().vehicleId !== VEHICLE_IDS.RAGNAROK) {
        return
      }
      runFlightTick(scene, position, tick)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useFlight
