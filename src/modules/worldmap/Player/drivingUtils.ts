import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import {
  DRIVING_CAMERA_LAG_SPEED_SHIFT,
  DRIVING_HARD_TURN_SHIFT,
  DRIVING_HARD_TURN_THRESHOLD,
  DRIVING_INPUT_MAGNITUDE,
  DRIVING_TURN_SHIFT,
} from '../../../constants/worldmapVehicles'
import { PSX_ANGLE_TO_RAD } from '../constants'
import { shortestPsxDelta, wrapPsxAngle } from './playerAngles'

export type DrivingCamera = {
  cameraModeIndex: number
  cameraYaw: number
}

export type DrivingInput = {
  altitude: number
  throttle: number
  turn: number
}

export type DrivingProfile = {
  accelerationDivisor: number
  coastStep: number
  extraTurnShift: number
  hasCameraLagSpeedCap: boolean
  topSpeed: number
}

const FIXED_POINT_SHIFT = 12
const FIXED_POINT_ONE = 1 << FIXED_POINT_SHIFT

const IDLE_DRIVING_INPUT: DrivingInput = { altitude: 0, throttle: 0, turn: 0 }

const isHeld = (padButtons: number, bit: number) => (padButtons & bit) !== 0

const readAxis = (padButtons: number, winningBit: number, losingBit: number) => {
  if (isHeld(padButtons, winningBit)) {
    return DRIVING_INPUT_MAGNITUDE
  }
  return isHeld(padButtons, losingBit) ? -DRIVING_INPUT_MAGNITUDE : 0
}

export const readDrivingInput = (padButtons: number, isIgnored: boolean): DrivingInput => {
  if (isIgnored) {
    return IDLE_DRIVING_INPUT
  }
  return {
    altitude: readAxis(padButtons, WORLDMAP_PAD_BITS.forward, WORLDMAP_PAD_BITS.backward),
    throttle: -readAxis(padButtons, WORLDMAP_PAD_BITS.cancel, WORLDMAP_PAD_BITS.card),
    turn: readAxis(padButtons, WORLDMAP_PAD_BITS.left, WORLDMAP_PAD_BITS.right),
  }
}

const isHardTurn = (yaw: number, camera: DrivingCamera) => {
  const unwrappedYawDifference = camera.cameraYaw - yaw
  return camera.cameraModeIndex === 0 && Math.abs(unwrappedYawDifference) > DRIVING_HARD_TURN_THRESHOLD
}

export const stepVehicleYaw = (yaw: number, turn: number, camera: DrivingCamera, profile: DrivingProfile) => {
  if (turn === 0) {
    return yaw
  }
  const shift = isHardTurn(yaw, camera) ? DRIVING_HARD_TURN_SHIFT : DRIVING_TURN_SHIFT
  return wrapPsxAngle(yaw + ((-turn >> shift) >> profile.extraTurnShift))
}

export const moveTowardZero = (value: number, step: number) => {
  if (Math.abs(value) <= step) {
    return 0
  }
  return value - Math.sign(value) * step
}

export const calculateSpeedCap = (yaw: number, camera: DrivingCamera, profile: DrivingProfile) => {
  if (!profile.hasCameraLagSpeedCap || camera.cameraModeIndex !== 0) {
    return profile.topSpeed
  }
  return profile.topSpeed - (Math.abs(shortestPsxDelta(camera.cameraYaw, yaw)) >> DRIVING_CAMERA_LAG_SPEED_SHIFT)
}

// A negative cap flips the velocity's sign every tick instead of clamping, as the original does.
const clampToSpeedCap = (velocity: number, cap: number) => {
  if (velocity < -cap) {
    return -cap
  }
  return velocity > cap ? cap : velocity
}

export const stepVehicleVelocity = (velocity: number, throttle: number, speedCap: number, profile: DrivingProfile) => {
  if (throttle === 0) {
    return moveTowardZero(velocity, profile.coastStep)
  }
  return clampToSpeedCap(velocity + Math.trunc(throttle / profile.accelerationDivisor), speedCap)
}

const scaleByFixedPointTrig = (distance: number, trig: number) =>
  (distance * Math.round(trig * FIXED_POINT_ONE)) >> FIXED_POINT_SHIFT

export const calculateHeadingStep = (distance: number, yaw: number) => {
  const angle = yaw * PSX_ANGLE_TO_RAD
  return {
    x: scaleByFixedPointTrig(distance, Math.sin(angle)),
    z: -scaleByFixedPointTrig(distance, Math.cos(angle)),
  }
}
