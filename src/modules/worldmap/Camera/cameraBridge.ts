import { Object3D, PerspectiveCamera, Vector3 } from 'three'

import { WORLDMAP_LANDING_YAW_SCALE } from '../../../constants/worldmapCamera'
import useGlobalStore from '../../../store'
import { updateCurvatureUniforms } from '../curvature'
import { getMovementOutputs } from '../Player/movementState'
import { isPadInputIgnored } from '../Player/onFootInput'
import { convertFieldDirectionToHeading } from '../Player/playerAngles'
import { isOnCanopyGround } from '../Player/playerUtils'
import { FieldLandingPosition } from '../useSections'
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
  landings: readonly FieldLandingPosition[]
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

const getSpawnCameraYaw = (landings: readonly FieldLandingPosition[]) => {
  const entry = landings[useWorldmapStore.getState().spawnPointId]
  return entry ? entry.player_yaw * WORLDMAP_LANDING_YAW_SCALE : undefined
}

const readInitialCameraMemory = ({ landings, playerPosition, tick }: CameraSceneContext) => {
  const { cameraModeIndex, vehicleId, worldMapState } = useWorldmapStore.getState()
  return createCameraMemory({
    cameraModeIndex,
    player: convertWorldToPsxPoint(playerPosition),
    tick,
    vehicleId,
    worldMapState,
    yaw: getSpawnCameraYaw(landings) ?? readPlayerHeading(),
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

export const applyCameraMemory = (camera: PerspectiveCamera, { focus, rig }: CameraMemory) => {
  placeWorldmapCamera(camera, rig, focus, useWorldmapStore.getState().vehicleId)
  updateCameraProjection(camera, rig.zoom)
  updateCurvatureUniforms(camera, rig.curvatureStart)
  publishCameraState({
    curvatureStart: rig.curvatureStart,
    depth: rig.depth,
    yawRadians: convertCameraYawToRadians(rig.yaw),
  })
}
