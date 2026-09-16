import { Camera, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { radToDeg } from 'three/src/math/MathUtils.js'

import { FIELD_CAMERA_FAR, FIELD_CAMERA_NEAR } from '../../../constants/camera'
import { SCREEN_HEIGHT } from '../../../constants/constants'
import { vectorToFloatingPoint } from '../../../utils'
import { FieldData } from '../Field'

const FF8_PERSPECTIVE_DIVISOR = 256

export const calculateFOV = (cameraZoom: number, screenHeight: number): number => {
  const perspectiveStrength = cameraZoom / FF8_PERSPECTIVE_DIVISOR

  const fovRadians = 2 * Math.atan(screenHeight / (2.0 * perspectiveStrength * FF8_PERSPECTIVE_DIVISOR))

  return radToDeg(fovRadians)
}

export const getCameraDirections = (camera: Camera) => {
  camera.updateMatrixWorld()

  const forwardVector = new Vector3()
  camera.getWorldDirection(forwardVector)
  const rightVector = new Vector3().crossVectors(camera.up, forwardVector).normalize().negate()
  const upVector = new Vector3().crossVectors(forwardVector, rightVector).normalize().negate()

  return {
    forwardVector,
    rightVector,
    upVector,
  }
}

export const getBoundaries = (
  cameraRange: FieldData['cameraRanges'][number],
  screenRange: FieldData['limits']['screenRange'],
) => {
  const halfScreenWidth = (screenRange.right - screenRange.left) / 2
  const halfScreenHeight = (screenRange.bottom - screenRange.top) / 2

  return {
    bottom: cameraRange.bottom - halfScreenHeight,
    left: cameraRange.left + halfScreenWidth,
    right: cameraRange.right - halfScreenWidth,
    top: cameraRange.top + halfScreenHeight,
  }
}

export const getCameraRangeIndex = (activeCameraId: number) => (activeCameraId ? 1 : 0)

const placeCamera = (target: PerspectiveCamera, position: Vector3, up: Vector3, lookAtTarget: Vector3, fov: number) => {
  target.far = FIELD_CAMERA_FAR
  target.near = FIELD_CAMERA_NEAR
  target.position.copy(position)
  target.up.copy(up)
  target.lookAt(lookAtTarget)
  target.fov = fov
  target.updateProjectionMatrix()
}

export const applyFieldCamera = (
  camera: PerspectiveCamera,
  moveableCamera: PerspectiveCamera,
  { camera_axis, camera_position, camera_zoom }: FieldData['cameras'][number],
) => {
  const camAxisX = vectorToFloatingPoint(camera_axis[0])
  const camAxisY = vectorToFloatingPoint(camera_axis[1]).negate()
  const camAxisZ = vectorToFloatingPoint(camera_axis[2])

  const camPos = vectorToFloatingPoint(new Vector3(...camera_position))
  camPos.y = -camPos.y

  const position = new Vector3(
    -(camPos.x * camAxisX.x + camPos.y * camAxisY.x + camPos.z * camAxisZ.x),
    -(camPos.x * camAxisX.y + camPos.y * camAxisY.y + camPos.z * camAxisZ.y),
    -(camPos.x * camAxisX.z + camPos.y * camAxisY.z + camPos.z * camAxisZ.z),
  )
  const lookAtTarget = position.clone().add(camAxisZ)
  const fov = calculateFOV(camera_zoom, SCREEN_HEIGHT)

  placeCamera(camera, position, camAxisY, lookAtTarget, fov)
  placeCamera(moveableCamera, position, camAxisY, lookAtTarget, fov)

  const direction = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().setFromEuler(camera.rotation))
  const { rightVector, upVector } = getCameraDirections(camera)

  camera.userData = {
    forwardAxis: camAxisZ.clone(),
    initialDirection: direction,
    initialPosition: camera.position.clone(),
    initialTargetPosition: lookAtTarget.clone(),
    rightAxis: rightVector,
    upAxis: upVector,
  }

  return lookAtTarget
}
