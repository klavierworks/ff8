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

export const getBoundaries = (limits: FieldData['limits']) => ({
  bottom: limits.cameraRange.bottom - limits.screenRange.bottom / 2,
  left: limits.cameraRange.left + limits.screenRange.right / 2,
  right: limits.cameraRange.right - limits.screenRange.right / 2,
  top: limits.cameraRange.top + limits.screenRange.bottom / 2,
})
