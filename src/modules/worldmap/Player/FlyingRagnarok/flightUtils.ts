import { MathUtils } from 'three'

import { TARGET_FPS } from '../../../../timing'
import { PSX_ANGLE_UNITS, WORLDMAP_SCALE } from '../../constants'
import { shortestRadiansDelta } from '../playerAngles'

const INPUT_AXIS_MAX = 127

const RAGNAROK_TOP_SPEED_PSX_PER_FRAME = 200
const RAGNAROK_THROTTLE_DIVISOR = 8
const RAGNAROK_DRAG_STEP_PSX_PER_FRAME = 16

const psxPerFrameToWorldPerSecond = (value: number) => value * TARGET_FPS * WORLDMAP_SCALE

const RAGNAROK_TOP_SPEED = psxPerFrameToWorldPerSecond(RAGNAROK_TOP_SPEED_PSX_PER_FRAME)
const RAGNAROK_THROTTLE_ACCEL_PER_AXIS = psxPerFrameToWorldPerSecond(1 / RAGNAROK_THROTTLE_DIVISOR) * TARGET_FPS
const RAGNAROK_DRAG_DECEL = psxPerFrameToWorldPerSecond(RAGNAROK_DRAG_STEP_PSX_PER_FRAME) * TARGET_FPS
const RAGNAROK_THROTTLE_FORWARD_AXIS = INPUT_AXIS_MAX
const RAGNAROK_THROTTLE_REVERSE_AXIS = -INPUT_AXIS_MAX

const RAGNAROK_YAW_DIVISOR_NORMAL = 4
const RAGNAROK_YAW_DIVISOR_HARD = 8
const RAGNAROK_YAW_HARD_THRESHOLD_PSX = 511

const psxAnglePerFrameToRadiansPerSecond = (value: number) => (value * TARGET_FPS * 2 * Math.PI) / PSX_ANGLE_UNITS

const RAGNAROK_YAW_RATE_PER_AXIS_NORMAL = psxAnglePerFrameToRadiansPerSecond(1 / RAGNAROK_YAW_DIVISOR_NORMAL)
const RAGNAROK_YAW_RATE_PER_AXIS_HARD = psxAnglePerFrameToRadiansPerSecond(1 / RAGNAROK_YAW_DIVISOR_HARD)
const RAGNAROK_YAW_HARD_THRESHOLD_RADIANS = (RAGNAROK_YAW_HARD_THRESHOLD_PSX / PSX_ANGLE_UNITS) * 2 * Math.PI

const RAGNAROK_BANK_INPUT_DIVISOR = 2
const RAGNAROK_BANK_LIMIT_PSX = 256
const RAGNAROK_BANK_RELAX_PSX_PER_FRAME = 32

const RAGNAROK_BANK_RATE_PER_AXIS = psxAnglePerFrameToRadiansPerSecond(1 / RAGNAROK_BANK_INPUT_DIVISOR)
const RAGNAROK_BANK_LIMIT = (RAGNAROK_BANK_LIMIT_PSX / PSX_ANGLE_UNITS) * 2 * Math.PI
const RAGNAROK_BANK_RELAX_RATE = psxAnglePerFrameToRadiansPerSecond(RAGNAROK_BANK_RELAX_PSX_PER_FRAME)

const RAGNAROK_ALTITUDE_INPUT_GAIN = 120
const RAGNAROK_CAMERA_TILT_RATE_PSX_PER_AXIS_FRAME = RAGNAROK_ALTITUDE_INPUT_GAIN / 512
const RAGNAROK_CAMERA_TILT_MAX_PSX = 4096

// Translates the port's high-level control booleans into the same ±127 axis
// bytes the original integrator reads. `isBraking` overrides accel so that
// holding both keys produces the brake/reverse direction (matching dpad-down
// vs cross in the original).
type RagnarokInputAxes = {
  altitudeAxis: number
  throttleAxis: number
  yawAxis: number
}

export const buildRagnarokInputAxes = (controls: {
  isAccelerating: boolean
  isBraking: boolean
  moveX: number
  moveY: number
}): RagnarokInputAxes => {
  let throttleAxis = 0
  if (controls.isBraking) {
    throttleAxis = RAGNAROK_THROTTLE_REVERSE_AXIS
  } else if (controls.isAccelerating) {
    throttleAxis = RAGNAROK_THROTTLE_FORWARD_AXIS
  }
  const yawAxis = controls.moveX * RAGNAROK_THROTTLE_FORWARD_AXIS
  const altitudeAxis = controls.moveY * RAGNAROK_THROTTLE_FORWARD_AXIS
  return { altitudeAxis, throttleAxis, yawAxis }
}

const relaxToward = (current: number, step: number): number => {
  if (Math.abs(current) <= step) {
    return 0
  }
  return current - Math.sign(current) * step
}

// Throttle adds throttle / 8 per frame, clamped to ±200 PSX/frame, with a
// ±16 PSX/frame drag toward 0 when no throttle button is held. In
// continuous-time units that becomes:
//   throttle held: velocity += axis * accelPerAxis * dt
//   no throttle:   velocity relaxes toward 0 at dragDecel per second
export const stepRagnarokSpeed = (currentSpeed: number, throttleAxis: number, deltaSeconds: number): number => {
  if (throttleAxis !== 0) {
    const next = currentSpeed + throttleAxis * RAGNAROK_THROTTLE_ACCEL_PER_AXIS * deltaSeconds
    return MathUtils.clamp(next, -RAGNAROK_TOP_SPEED, RAGNAROK_TOP_SPEED)
  }
  return relaxToward(currentSpeed, RAGNAROK_DRAG_DECEL * deltaSeconds)
}

// Heading turns by -input / 4 per frame normally, or -input / 8 when the
// heading lags the camera-target yaw by more than 511 PSX units.
// `targetYawRadians` is that camera-target reference used by the original's
// auto-yaw assist. The `-input` term rotates the yaw counter-clockwise for a
// left turn, the visually-correct direction in the standard `atan2(vx, vz)`
// orientation.
export const stepRagnarokYaw = (
  currentYawRadians: number,
  yawAxis: number,
  targetYawRadians: number,
  deltaSeconds: number,
): number => {
  if (yawAxis === 0) {
    return currentYawRadians
  }
  const delta = shortestRadiansDelta(targetYawRadians - currentYawRadians)
  const ratePerAxis =
    Math.abs(delta) > RAGNAROK_YAW_HARD_THRESHOLD_RADIANS
      ? RAGNAROK_YAW_RATE_PER_AXIS_HARD
      : RAGNAROK_YAW_RATE_PER_AXIS_NORMAL
  return currentYawRadians - yawAxis * ratePerAxis * deltaSeconds
}

// Bank accumulates input / 2 per frame, clamped to ±256 PSX units
// (= ±BANK_LIMIT), and relaxes at ±32 PSX/frame when input is 0. A left turn
// rolls about the +Z body axis (right wing up), matching a positive three.js
// `rotation.z`.
export const stepRagnarokBank = (currentBank: number, yawAxis: number, deltaSeconds: number): number => {
  if (yawAxis !== 0) {
    const next = currentBank + yawAxis * RAGNAROK_BANK_RATE_PER_AXIS * deltaSeconds
    return MathUtils.clamp(next, -RAGNAROK_BANK_LIMIT, RAGNAROK_BANK_LIMIT)
  }
  return relaxToward(currentBank, RAGNAROK_BANK_RELAX_RATE * deltaSeconds)
}

// Vertical velocity comes purely from the altitude axis — there is no
// projection from a heading-pitch.
export const ragnarokVerticalVelocity = (altitudeAxis: number, ratePerAxis: number): number => {
  return altitudeAxis * ratePerAxis
}

// The camera tilt accumulator decrements by gain * altitudeAxis / 512 per
// frame, clamped to ±4096. It drives the Ragnarok camera pitch target on a
// separate accumulator from vertical velocity — a higher climb rate tilts the
// camera toward the horizon.
export const stepRagnarokCameraTilt = (currentTiltPsx: number, altitudeAxis: number, deltaSeconds: number): number => {
  const step = altitudeAxis * RAGNAROK_CAMERA_TILT_RATE_PSX_PER_AXIS_FRAME * TARGET_FPS * deltaSeconds
  return MathUtils.clamp(currentTiltPsx - step, -RAGNAROK_CAMERA_TILT_MAX_PSX, RAGNAROK_CAMERA_TILT_MAX_PSX)
}

// Yaw 0 faces +Z, increasing yaw rotates toward +X — matching the rest of the
// worldmap where `Math.atan2(vx, vz)` yields the field direction.
type FlightVelocity = { x: number; y: number; z: number }

export const horizontalVelocity = (yawRadians: number, speed: number, output: FlightVelocity): FlightVelocity => {
  output.x = Math.sin(yawRadians) * speed
  output.z = Math.cos(yawRadians) * speed
  return output
}

export const wrapWorldAxis = (value: number, wrap: number): number => {
  const wrapped = value % wrap
  return wrapped < 0 ? wrapped + wrap : wrapped
}
