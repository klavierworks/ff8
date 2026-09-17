import { MathUtils } from 'three'

import { PSX_ANGLE_TO_RAD, PSX_ANGLE_UNITS } from '../constants'

export const wrapPsxAngle = (angle: number) => MathUtils.euclideanModulo(angle, PSX_ANGLE_UNITS)

export const radiansToPsx = (radians: number) => wrapPsxAngle(radians / PSX_ANGLE_TO_RAD)

export const psxToRadians = (psx: number) => psx * PSX_ANGLE_TO_RAD

export const shortestPsxDelta = (current: number, target: number) => {
  const delta = wrapPsxAngle(target - current)
  return delta > PSX_ANGLE_UNITS / 2 ? delta - PSX_ANGLE_UNITS : delta
}

export const calculateOffsetHeading = (dx: number, dz: number) =>
  wrapPsxAngle(Math.round(radiansToPsx(Math.atan2(dx, -dz))))

const mirrorPsxAngle = (angle: number) => wrapPsxAngle(PSX_ANGLE_UNITS / 2 - angle)

export const convertHeadingToFieldDirection = mirrorPsxAngle

export const convertFieldDirectionToHeading = mirrorPsxAngle
