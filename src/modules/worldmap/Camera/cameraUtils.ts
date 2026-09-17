import { Euler, Mesh, Object3D, PerspectiveCamera, Raycaster, Vector3 } from 'three'

import { SCREEN_HEIGHT } from '../../../constants/constants'
import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import {
  WORLDMAP_CAMERA_HEIGHT_OFFSET_PSX,
  WORLDMAP_OCCLUSION_MARGIN_PSX,
  WORLDMAP_OCCLUSION_TARGET_HEIGHT_PSX,
} from '../../../constants/worldmapCamera'
import { calculateFOV } from '../../field/Camera/cameraUtils'
import { WALKMESH_USER_DATA_KEY, WORLDMAP_SCALE } from '../constants'
import { psxToRadians, radiansToPsx, wrapPsxAngle } from '../Player/playerAngles'
import { getRenderedFocusAltitude, PsxPoint } from './cameraFocus'
import { CameraRig } from './cameraRig'

const ROTATE_LEFT_BIT = WORLDMAP_PAD_BITS.cameraRotateLeft
const ROTATE_RIGHT_BIT = WORLDMAP_PAD_BITS.cameraRotateRight

const _euler = new Euler(0, 0, 0, 'YXZ')
const _offset = new Vector3()
const _target = new Vector3()
const _direction = new Vector3()
const _raycaster = new Raycaster()

export const convertCameraYawToRadians = (yaw: number) => psxToRadians(-yaw)

export const convertRadiansToCameraYaw = (radians: number) => wrapPsxAngle(Math.round(radiansToPsx(-radians)))

export const convertWorldToPsxPoint = (position: Vector3): PsxPoint => ({
  altitude: Math.round(-position.y / WORLDMAP_SCALE),
  x: Math.round(position.x / WORLDMAP_SCALE),
  z: Math.round(position.z / WORLDMAP_SCALE),
})

export const getRotateInput = (padButtons: number) => {
  const isLeftHeld = (padButtons & ROTATE_LEFT_BIT) !== 0
  const isRightHeld = (padButtons & ROTATE_RIGHT_BIT) !== 0
  if (isLeftHeld === isRightHeld) {
    return 0
  }
  return isLeftHeld ? 1 : -1
}

export const placeWorldmapCamera = (camera: PerspectiveCamera, rig: CameraRig, focus: PsxPoint, vehicleId: number) => {
  _euler.set(psxToRadians(rig.pitch), convertCameraYawToRadians(rig.yaw), 0)
  camera.quaternion.setFromEuler(_euler)
  _offset.set(0, WORLDMAP_CAMERA_HEIGHT_OFFSET_PSX, -rig.depth).multiplyScalar(WORLDMAP_SCALE)
  _offset.applyQuaternion(camera.quaternion)
  camera.position
    .set(focus.x, -getRenderedFocusAltitude(focus, vehicleId), focus.z)
    .multiplyScalar(WORLDMAP_SCALE)
    .add(_offset)
  camera.updateMatrixWorld()
}

export const updateCameraProjection = (camera: PerspectiveCamera, zoom: number) => {
  const fov = calculateFOV(zoom, SCREEN_HEIGHT)
  if (camera.fov === fov) {
    return
  }
  camera.fov = fov
  camera.updateProjectionMatrix()
}

const isWalkmeshHit = (object: Object3D) => object instanceof Mesh && object.userData[WALKMESH_USER_DATA_KEY] === true

export const isTerrainOccludingPlayer = (scene: Object3D, camera: PerspectiveCamera, playerPosition: Vector3) => {
  _target.copy(playerPosition)
  _target.y += WORLDMAP_OCCLUSION_TARGET_HEIGHT_PSX * WORLDMAP_SCALE
  _direction.subVectors(_target, camera.position)
  const distance = _direction.length() - WORLDMAP_OCCLUSION_MARGIN_PSX * WORLDMAP_SCALE
  if (distance <= 0) {
    return false
  }
  _raycaster.set(camera.position, _direction.normalize())
  _raycaster.far = distance
  return _raycaster.intersectObjects(scene.children, true).some((hit) => isWalkmeshHit(hit.object))
}
