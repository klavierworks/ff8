import { Camera, Vector3 } from 'three'
import { radToDeg } from 'three/src/math/MathUtils.js'

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
