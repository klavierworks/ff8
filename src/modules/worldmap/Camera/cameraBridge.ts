import { Object3D, PerspectiveCamera, Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { updateCurvatureUniforms } from '../curvature'
import { getMovementOutputs } from '../Player/movementState'
import { isPadInputIgnored } from '../Player/onFootInput'
import { convertFieldDirectionToHeading } from '../Player/playerAngles'
import { isOnCanopyGround } from '../Player/playerUtils'
import { placeRideCamera } from '../Trains/trainPlacement'
import { getRideCameraView } from '../Trains/trainRide'
import { getTrainSession } from '../Trains/trainSession'
import { isWalkerClass } from '../vehicleClasses'
import useWorldmapStore, { WorldmapCameraState } from '../worldmapStore'
import { hasTerrainPitchDip } from './cameraPitch'
import { CameraMemory, CameraTickInput, createCameraMemory, runCameraTick } from './cameraTick'
import {
  convertCameraYawToRadians,
  convertWorldToPsxPoint,
  getRotateInput,
  isTerrainOccludingPlayer,
  placeWorldmapCamera,
  updateCameraProjection,
} from './cameraUtils'

type CameraSceneContext = {
  camera: PerspectiveCamera
  playerPosition: Vector3
  scene: Object3D
  tick: number
}

const readMovementForTick = (tick: number) => {
  const outputs = getMovementOutputs()
  if (outputs.tick !== tick) {
    return { isMoving: false, isNoSteering: true }
  }
  return { isMoving: outputs.isMoving, isNoSteering: outputs.isNoSteering }
}

const readRotateInput = (tick: number) =>
  isPadInputIgnored(tick) ? 0 : getRotateInput(useWorldmapStore.getState().controls.padButtons)

const readPlayerHeading = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

const readCameraTickInput = ({ camera, playerPosition, scene, tick }: CameraSceneContext): CameraTickInput => {
  const { cameraModeIndex, controls, vehicleId, worldMapState } = useWorldmapStore.getState()
  const isWalker = isWalkerClass(vehicleId)
  const isOccluded =
    hasTerrainPitchDip(vehicleId, cameraModeIndex) && isTerrainOccludingPlayer(scene, camera, playerPosition)
  return {
    cameraModeIndex,
    headingPsx: readPlayerHeading(),
    ...readMovementForTick(tick),
    isOccluded,
    isOnCanopyGround: isOnCanopyGround(),
    isThrottling: !isWalker && (controls.isAccelerating || controls.isBraking),
    isTurning: !isWalker && controls.moveX !== 0,
    player: convertWorldToPsxPoint(playerPosition),
    rotateInput: readRotateInput(tick),
    tick,
    vehicleId,
    worldMapState,
  }
}

const readInitialCameraMemory = ({ playerPosition, tick }: CameraSceneContext) => {
  const { cameraModeIndex, entryCameraYaw, vehicleId, worldMapState } = useWorldmapStore.getState()
  return createCameraMemory({
    cameraModeIndex,
    player: convertWorldToPsxPoint(playerPosition),
    tick,
    vehicleId,
    worldMapState,
    yaw: entryCameraYaw ?? readPlayerHeading(),
  })
}

export const advanceCameraMemory = (memory: CameraMemory | null, context: CameraSceneContext) =>
  memory ? runCameraTick(memory, readCameraTickInput(context)) : readInitialCameraMemory(context)

const isCameraStateEqual = (a: WorldmapCameraState, b: WorldmapCameraState) =>
  a.curvatureStart === b.curvatureStart && a.depth === b.depth && a.yawRadians === b.yawRadians

const publishCameraState = (next: WorldmapCameraState) => {
  if (isCameraStateEqual(useWorldmapStore.getState().camera, next)) {
    return
  }
  useWorldmapStore.setState({ camera: next })
}

const placeCamera = (camera: PerspectiveCamera, { focus, rig }: CameraMemory) => {
  const rideView = getRideCameraView(getTrainSession(), useWorldmapStore.getState().worldMapState)
  if (rideView) {
    placeRideCamera(camera, rideView)
    return
  }
  placeWorldmapCamera(camera, rig, focus, useWorldmapStore.getState().vehicleId)
}

export const applyCameraMemory = (camera: PerspectiveCamera, memory: CameraMemory) => {
  const { rig } = memory
  placeCamera(camera, memory)
  updateCameraProjection(camera, rig.zoom)
  updateCurvatureUniforms(camera, rig.curvatureStart)
  publishCameraState({
    curvatureStart: rig.curvatureStart,
    depth: rig.depth,
    yawRadians: convertCameraYawToRadians(rig.yaw),
  })
}
