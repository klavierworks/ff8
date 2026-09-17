import { MathUtils } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../../constants/controls'
import { PSX_ANGLE_TO_RAD } from '../../constants'
import {
  RAGNAROK_ALTITUDE_GAIN,
  RAGNAROK_ALTITUDE_SHIFT,
  RAGNAROK_BANK_LIMIT,
  RAGNAROK_BANK_RELAX_STEP,
  RAGNAROK_BANK_SHIFT,
  RAGNAROK_CAMERA_LAG_SPEED_SHIFT,
  RAGNAROK_CEILING_ALTITUDE,
  RAGNAROK_DRAG_STEP,
  RAGNAROK_GROUND_CLEARANCE,
  RAGNAROK_INPUT_MAGNITUDE,
  RAGNAROK_THROTTLE_DIVISOR,
  RAGNAROK_TOP_SPEED,
  RAGNAROK_YAW_HARD_TURN_SHIFT,
  RAGNAROK_YAW_HARD_TURN_THRESHOLD,
  RAGNAROK_YAW_SHIFT,
} from '../constants'
import { shortestPsxDelta, wrapPsxAngle } from '../playerAngles'

export type FlightCamera = {
  cameraModeIndex: number
  cameraYaw: number
}

type RagnarokInput = {
  altitude: number
  throttle: number
  turn: number
}

const FIXED_POINT_SHIFT = 12
const FIXED_POINT_ONE = 1 << FIXED_POINT_SHIFT

const CANCEL_BIT = WORLDMAP_PAD_BITS.cancel
const CARD_BIT = WORLDMAP_PAD_BITS.card
const UP_BIT = WORLDMAP_PAD_BITS.forward
const DOWN_BIT = WORLDMAP_PAD_BITS.backward
const LEFT_BIT = WORLDMAP_PAD_BITS.left
const RIGHT_BIT = WORLDMAP_PAD_BITS.right

const IDLE_RAGNAROK_INPUT: RagnarokInput = { altitude: 0, throttle: 0, turn: 0 }

const isHeld = (padButtons: number, bit: number) => (padButtons & bit) !== 0

const readAxis = (padButtons: number, winningBit: number, losingBit: number) => {
  if (isHeld(padButtons, winningBit)) {
    return RAGNAROK_INPUT_MAGNITUDE
  }
  return isHeld(padButtons, losingBit) ? -RAGNAROK_INPUT_MAGNITUDE : 0
}

export const readRagnarokInput = (padButtons: number, isIgnored: boolean): RagnarokInput => {
  if (isIgnored) {
    return IDLE_RAGNAROK_INPUT
  }
  return {
    altitude: readAxis(padButtons, UP_BIT, DOWN_BIT),
    throttle: -readAxis(padButtons, CANCEL_BIT, CARD_BIT),
    turn: readAxis(padButtons, LEFT_BIT, RIGHT_BIT),
  }
}

const isHardTurn = (shipYaw: number, camera: FlightCamera) => {
  const unwrappedYawDifference = camera.cameraYaw - shipYaw
  return camera.cameraModeIndex === 0 && Math.abs(unwrappedYawDifference) > RAGNAROK_YAW_HARD_TURN_THRESHOLD
}

export const stepShipYaw = (shipYaw: number, turn: number, camera: FlightCamera) => {
  if (turn === 0) {
    return shipYaw
  }
  const shift = isHardTurn(shipYaw, camera) ? RAGNAROK_YAW_HARD_TURN_SHIFT : RAGNAROK_YAW_SHIFT
  return wrapPsxAngle(shipYaw + (-turn >> shift))
}

const moveTowardZero = (value: number, step: number) => {
  if (Math.abs(value) <= step) {
    return 0
  }
  return value - Math.sign(value) * step
}

export const stepShipBank = (bank: number, turn: number) => {
  if (turn === 0) {
    return moveTowardZero(bank, RAGNAROK_BANK_RELAX_STEP)
  }
  return MathUtils.clamp(bank + (turn >> RAGNAROK_BANK_SHIFT), -RAGNAROK_BANK_LIMIT, RAGNAROK_BANK_LIMIT)
}

const calculateSpeedCap = (shipYaw: number, camera: FlightCamera) => {
  if (camera.cameraModeIndex !== 0) {
    return RAGNAROK_TOP_SPEED
  }
  return RAGNAROK_TOP_SPEED - (Math.abs(shortestPsxDelta(camera.cameraYaw, shipYaw)) >> RAGNAROK_CAMERA_LAG_SPEED_SHIFT)
}

export const stepShipVelocity = (velocity: number, throttle: number, shipYaw: number, camera: FlightCamera) => {
  if (throttle === 0) {
    return moveTowardZero(velocity, RAGNAROK_DRAG_STEP)
  }
  const cap = calculateSpeedCap(shipYaw, camera)
  return MathUtils.clamp(velocity + Math.trunc(throttle / RAGNAROK_THROTTLE_DIVISOR), -cap, cap)
}

export const stepShipAltitude = (altitude: number, altitudeInput: number) =>
  altitude + ((RAGNAROK_ALTITUDE_GAIN * altitudeInput) >> RAGNAROK_ALTITUDE_SHIFT)

export const clampShipAltitude = (altitude: number, groundAltitude: number | undefined) => {
  const belowCeiling = Math.max(altitude, RAGNAROK_CEILING_ALTITUDE)
  if (groundAltitude === undefined) {
    return belowCeiling
  }
  return Math.min(belowCeiling, groundAltitude - RAGNAROK_GROUND_CLEARANCE)
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
