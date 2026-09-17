import { useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Object3D, Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import useGlobalStore from '../../../../store'
import { MEMORY } from '../../../field/Scripts/Script/handlers'
import useScriptTick from '../../useScriptTick'
import { readSavedCameraMode } from '../../worldmapSaveData'
import useWorldmapStore, {
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY, RAGNAROK_FOLDED_FRAME } from '../constants'
import { convertFieldDirectionToHeading } from '../playerAngles'
import { findGroundAltitude, readShipPose, writeShipPose } from '../shipPose'
import { storeRagnarokPose } from './ragnarokEntity'
import { getRagnarokOutputs, getRagnarokTrip, setRagnarokOutputs } from './ragnarokState'
import {
  advanceTransition,
  createLanding,
  createTakeoff,
  isTransitionFinished,
  ShipTransition,
  stepLandingFrame,
  stepTakeoffFrame,
} from './transitionUtils'

const isTransitionState = (worldMapState: number) =>
  worldMapState === WORLD_MAP_STATE_RAGNAROK_TAKEOFF || worldMapState === WORLD_MAP_STATE_RAGNAROK_LANDING

const readShipYaw = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

const startTransition = (scene: Object3D, position: Vector3, kind: number) => {
  const pose = readShipPose(position)
  const ground = findGroundAltitude(scene, pose.x, pose.z) ?? pose.altitude
  const isTakeoff = kind === WORLD_MAP_STATE_RAGNAROK_TAKEOFF
  setRagnarokOutputs({ ...getRagnarokOutputs(), animationFrame: isTakeoff ? RAGNAROK_FOLDED_FRAME : 0, velocity: 0 })
  return isTakeoff ? createTakeoff(pose.altitude, ground) : createLanding(pose.altitude, ground)
}

const stepAnimationFrame = (transition: ShipTransition) => {
  const outputs = getRagnarokOutputs()
  const animationFrame =
    transition.kind === WORLD_MAP_STATE_RAGNAROK_TAKEOFF
      ? stepTakeoffFrame(outputs.animationFrame, transition.counter)
      : stepLandingFrame(outputs.animationFrame)
  setRagnarokOutputs({ ...outputs, animationFrame })
}

const finishLanding = (position: Vector3) => {
  const shipPose = readShipPose(position)
  const { landingSpot, restoredVehicleId } = getRagnarokTrip()
  storeRagnarokPose(shipPose, readShipYaw())
  writeShipPose(position, landingSpot ?? shipPose)
  useWorldmapStore.setState({
    cameraModeIndex: readSavedCameraMode(MEMORY),
    vehicleId: restoredVehicleId,
    worldMapState: WORLD_MAP_STATE_FREE_ROAM,
  })
}

const finishTransition = (position: Vector3, kind: number) => {
  if (kind === WORLD_MAP_STATE_RAGNAROK_LANDING) {
    finishLanding(position)
    return
  }
  useWorldmapStore.setState({ worldMapState: WORLD_MAP_STATE_FREE_ROAM })
}

const runTransitionTick = (scene: Object3D, position: Vector3, current: null | ShipTransition, kind: number) => {
  const transition = current?.kind === kind ? current : startTransition(scene, position, kind)
  const pose = readShipPose(position)
  writeShipPose(position, { ...pose, altitude: pose.altitude + transition.altitudeStep })
  stepAnimationFrame(transition)
  if (!isTransitionFinished(transition)) {
    return advanceTransition(transition)
  }
  finishTransition(position, kind)
  return null
}

const mirrorShipIntoEntity = (position: Vector3) => {
  if (useWorldmapStore.getState().vehicleId !== VEHICLE_IDS.RAGNAROK) {
    return
  }
  storeRagnarokPose(readShipPose(position), readShipYaw())
}

const useTransition = () => {
  const scene = useThree((state) => state.scene)
  const transitionRef = useRef<null | ShipTransition>(null)

  useScriptTick(
    () => {
      const { vehicleId, worldMapState } = useWorldmapStore.getState()
      const position = useGlobalStore.getState().characterPosition
      if (!position || vehicleId !== VEHICLE_IDS.RAGNAROK) {
        transitionRef.current = null
        return
      }
      transitionRef.current = isTransitionState(worldMapState)
        ? runTransitionTick(scene, position, transitionRef.current, worldMapState)
        : null
      mirrorShipIntoEntity(position)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useTransition
