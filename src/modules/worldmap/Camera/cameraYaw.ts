import { MathUtils } from 'three'

import {
  WORLDMAP_YAW_FACING_CAMERA_RANGE,
  WORLDMAP_YAW_FOLLOW_ACCELERATION,
  WORLDMAP_YAW_FOLLOW_DECELERATION,
  WORLDMAP_YAW_FOLLOW_ENGAGE_RANGE,
  WORLDMAP_YAW_OVERFLOW_STEP,
  WORLDMAP_YAW_RELEASE_SNAP,
  WORLDMAP_YAW_SETTLE_RANGE,
  WORLDMAP_YAW_VELOCITY_DIVISOR,
  WORLDMAP_YAW_VELOCITY_LIMIT,
  WORLDMAP_YAW_VELOCITY_STEP,
} from '../../../constants/worldmapCamera'
import { PSX_ANGLE_UNITS } from '../constants'
import { shortestPsxDelta } from '../Player/playerAngles'

type OnFootYawInput = {
  headingPsx: number
  isNoSteering: boolean
  rotateInput: number
}

type YawStep = {
  velocity: number
  yaw: number
}

const HALF_TURN = PSX_ANGLE_UNITS / 2

const applyRotateInput = (velocity: number, rotateInput: number) =>
  rotateInput > 0 ? velocity - WORLDMAP_YAW_VELOCITY_STEP : velocity + WORLDMAP_YAW_VELOCITY_STEP

const decayVelocity = (velocity: number) => Math.floor((3 * velocity) / 4)

const releaseVelocity = (velocity: number) =>
  Math.abs(velocity) < WORLDMAP_YAW_RELEASE_SNAP ? 0 : decayVelocity(velocity)

const convertVelocityToYawStep = (velocity: number) => Math.floor(velocity / WORLDMAP_YAW_VELOCITY_DIVISOR)

const isFacingCamera = (difference: number) =>
  Math.abs(Math.abs(difference) - HALF_TURN) < WORLDMAP_YAW_FACING_CAMERA_RANGE

const calculateOnFootVelocity = (velocity: number, difference: number, input: OnFootYawInput) => {
  if (input.rotateInput !== 0) {
    return applyRotateInput(velocity, input.rotateInput)
  }
  if (input.isNoSteering) {
    return releaseVelocity(velocity)
  }
  if (Math.abs(difference) < WORLDMAP_YAW_SETTLE_RANGE) {
    return decayVelocity(velocity)
  }
  if (isFacingCamera(difference)) {
    return Math.floor(velocity / 2)
  }
  return difference > 0 ? velocity + WORLDMAP_YAW_VELOCITY_STEP : velocity - WORLDMAP_YAW_VELOCITY_STEP
}

const applyOnFootVelocity = (yaw: number, velocity: number): YawStep => {
  if (velocity < -WORLDMAP_YAW_VELOCITY_LIMIT) {
    return { velocity: -WORLDMAP_YAW_VELOCITY_LIMIT, yaw: yaw - WORLDMAP_YAW_OVERFLOW_STEP }
  }
  if (velocity > WORLDMAP_YAW_VELOCITY_LIMIT) {
    return { velocity: WORLDMAP_YAW_VELOCITY_LIMIT, yaw: yaw + WORLDMAP_YAW_OVERFLOW_STEP }
  }
  return { velocity, yaw: yaw + convertVelocityToYawStep(velocity) }
}

export const stepOnFootYaw = (yaw: number, velocity: number, input: OnFootYawInput): YawStep => {
  const difference = shortestPsxDelta(yaw, input.headingPsx)
  return applyOnFootVelocity(yaw, calculateOnFootVelocity(velocity, difference, input))
}

const calculateManualVelocity = (velocity: number, rotateInput: number) => {
  if (rotateInput !== 0) {
    return MathUtils.clamp(
      applyRotateInput(velocity, rotateInput),
      -WORLDMAP_YAW_VELOCITY_LIMIT,
      WORLDMAP_YAW_VELOCITY_LIMIT,
    )
  }
  return releaseVelocity(velocity)
}

export const stepManualVehicleYaw = (yaw: number, velocity: number, rotateInput: number): YawStep => {
  const nextVelocity = calculateManualVelocity(velocity, rotateInput)
  return { velocity: nextVelocity, yaw: yaw + convertVelocityToYawStep(nextVelocity) }
}

const calculateFollowSpeedCap = (difference: number) => Math.min(Math.abs(difference >> 1), WORLDMAP_YAW_VELOCITY_LIMIT)

const calculateFollowSpeed = (speed: number, difference: number) => {
  const accelerated =
    Math.abs(difference) >= WORLDMAP_YAW_FOLLOW_ENGAGE_RANGE
      ? speed + WORLDMAP_YAW_FOLLOW_ACCELERATION
      : speed - WORLDMAP_YAW_FOLLOW_DECELERATION
  return MathUtils.clamp(accelerated, 0, calculateFollowSpeedCap(difference))
}

export const stepFollowVehicleYaw = (yaw: number, speed: number, headingPsx: number): YawStep => {
  const difference = shortestPsxDelta(yaw, headingPsx)
  const nextSpeed = calculateFollowSpeed(speed, difference)
  const step = convertVelocityToYawStep(nextSpeed)
  return { velocity: nextSpeed, yaw: difference > 0 ? yaw + step : yaw - step }
}
