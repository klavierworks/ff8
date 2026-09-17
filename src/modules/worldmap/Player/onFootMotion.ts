import { Vector3 } from 'three'

import { HEADING_SNAP_RANGE_PSX, HEADING_TURN_STEP_PSX, VELOCITY_INPUT_MULTIPLIER } from './constants'
import { OnFootInput } from './onFootInput'
import { radiansToPsx, shortestPsxDelta, wrapPsxAngle } from './playerAngles'

export type OnFootVelocity = {
  x: number
  z: number
}

const _yAxis = new Vector3(0, 1, 0)
const _velocity = new Vector3()

const ZERO_VELOCITY: OnFootVelocity = { x: 0, z: 0 }

const scaleInputAxis = (value: number, shift: number) => (VELOCITY_INPUT_MULTIPLIER * value) >> shift

export const isVelocityZero = ({ x, z }: OnFootVelocity) => x === 0 && z === 0

export const calculateOnFootVelocity = (
  input: OnFootInput,
  cameraYawRadians: number,
  velocityShift: number,
): OnFootVelocity => {
  if (!input.isMoving) {
    return ZERO_VELOCITY
  }
  _velocity
    .set(scaleInputAxis(input.x, velocityShift), 0, -scaleInputAxis(input.z, velocityShift))
    .applyAxisAngle(_yAxis, cameraYawRadians)
  return { x: Math.round(_velocity.x), z: Math.round(_velocity.z) }
}

const getVelocityHeadingPsx = ({ x, z }: OnFootVelocity) => Math.round(radiansToPsx(Math.atan2(x, z)))

export const calculateTargetHeadingPsx = (velocity: OnFootVelocity, lastSlideAnglePsx: number) =>
  wrapPsxAngle(getVelocityHeadingPsx(velocity) - (lastSlideAnglePsx >> 1))

export const stepOnFootHeading = (currentPsx: number, targetPsx: number) => {
  const delta = shortestPsxDelta(currentPsx, targetPsx)
  if (Math.abs(delta) <= HEADING_SNAP_RANGE_PSX) {
    return { headingPsx: targetPsx, isTurnClamped: false }
  }
  return { headingPsx: wrapPsxAngle(currentPsx + Math.sign(delta) * HEADING_TURN_STEP_PSX), isTurnClamped: true }
}
