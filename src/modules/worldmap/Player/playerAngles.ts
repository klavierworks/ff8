import { PSX_ANGLE_UNITS } from '../constants'

const TWO_PI = 2 * Math.PI

export const wrapPsxAngle = (angle: number): number => ((angle % PSX_ANGLE_UNITS) + PSX_ANGLE_UNITS) % PSX_ANGLE_UNITS

export const radiansToPsx = (radians: number): number => wrapPsxAngle((radians / TWO_PI) * PSX_ANGLE_UNITS)

export const psxToRadians = (psx: number): number => (psx / PSX_ANGLE_UNITS) * TWO_PI

export const shortestPsxDelta = (current: number, target: number): number => {
  const delta = wrapPsxAngle(target - current)
  return delta > PSX_ANGLE_UNITS / 2 ? delta - PSX_ANGLE_UNITS : delta
}

export const shortestRadiansDelta = (delta: number): number => {
  return (((delta % TWO_PI) + 3 * Math.PI) % TWO_PI) - Math.PI
}
