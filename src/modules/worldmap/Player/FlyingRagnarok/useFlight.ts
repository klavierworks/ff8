import { useThree } from '@react-three/fiber'
import { Object3D, Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { RAGNAROK_DRIVING } from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { convertRadiansToCameraYaw } from '../../Camera/cameraUtils'
import { WORLDMAP_STATE } from '../../Scripts/state'
import useScriptTick from '../../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import {
  calculateHeadingStep,
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
import { isShipBlockedByEntity } from './boardingUtils'
import { clampShipAltitude, stepShipAltitude, stepShipBank } from './flightUtils'
import { getRagnarokOutputs, setRagnarokOutputs } from './ragnarokState'

const readInputForTick = (tick: number) =>
  readDrivingInput(useWorldmapStore.getState().controls.padButtons, isPadInputIgnored(tick))

const readFlightCamera = (): DrivingCamera => {
  const { camera, cameraModeIndex } = useWorldmapStore.getState()
  return { cameraModeIndex, cameraYaw: convertRadiansToCameraYaw(camera.yawRadians) }
}

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

const moveShip = (scene: Object3D, position: Vector3, shipYaw: number, velocity: number, altitudeInput: number) => {
  const pose = readShipPose(position)
  const target = calculateTargetPose(pose, shipYaw, velocity, altitudeInput)
  if (isShipBlockedByEntity(target)) {
    writeShipPose(position, pose)
    return 0
  }
  writeShipPose(position, settleOnTerrain(scene, target))
  return velocity
}

const updateFieldDirection = (shipYaw: number) => {
  const fieldDirection = convertHeadingToFieldDirection(shipYaw)
  if (fieldDirection !== useGlobalStore.getState().fieldDirection) {
    useGlobalStore.setState({ fieldDirection })
  }
}

const runFlightTick = (scene: Object3D, position: Vector3, tick: number) => {
  const input = readInputForTick(tick)
  const camera = readFlightCamera()
  const outputs = getRagnarokOutputs()
  const shipYaw = stepVehicleYaw(
    convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection),
    input.turn,
    camera,
    RAGNAROK_DRIVING,
  )
  const bank = stepShipBank(outputs.bank, input.turn)

  if (useWorldmapStore.getState().worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
    setRagnarokOutputs({ ...outputs, bank })
    return
  }

  const velocity = stepVehicleVelocity(outputs.velocity, input.throttle, shipYaw, camera, RAGNAROK_DRIVING)
  const movedVelocity = moveShip(scene, position, shipYaw, velocity, input.altitude)
  setRagnarokOutputs({ ...outputs, bank, velocity: movedVelocity })
  updateFieldDirection(shipYaw)
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
