import { MathUtils, Vector3 } from 'three'

import { TARGET_FPS } from '../../../timing'
import { PSX_ANGLE_TO_RAD } from '../constants'

const RAGNAROK_CAMERA_PITCH_BASE_PSX = 256
const RAGNAROK_CAMERA_TILT_DIVISOR = 24

export const WORLDMAP_CAMERA_MODES = [
  { pitchAboveHorizonRadians: 112 * PSX_ANGLE_TO_RAD, zoom: 1024 },
  { pitchAboveHorizonRadians: 512 * PSX_ANGLE_TO_RAD, zoom: 640 },
]

const wrapDelta = (delta: number, wrap: number) => {
  const half = wrap / 2
  if (delta > half) {
    return delta - wrap
  }
  if (delta < -half) {
    return delta + wrap
  }
  return delta
}

export const frameRateAdjustedAlpha = (alphaPerFrame: number, deltaSeconds: number) => {
  const frames = deltaSeconds * TARGET_FPS
  return 1 - Math.pow(1 - alphaPerFrame, frames)
}

export const smoothFollowAxis = (current: number, target: number, alpha: number, wrap?: number) => {
  if (wrap === undefined) {
    return current + (target - current) * alpha
  }
  const next = current + wrapDelta(target - current, wrap) * alpha
  return ((next % wrap) + wrap) % wrap
}

export const stepToward = (current: number, target: number, maxStep: number) => {
  const delta = target - current
  if (Math.abs(delta) <= maxStep) {
    return target
  }
  return current + Math.sign(delta) * maxStep
}

export const computeWorldmapCameraPosition = (
  target: Vector3,
  yawRadians: number,
  pitchAboveHorizonRadians: number,
  distance: number,
  output: Vector3,
) => {
  const horizontal = distance * Math.cos(pitchAboveHorizonRadians)
  const vertical = distance * Math.sin(pitchAboveHorizonRadians)
  output.set(
    target.x + horizontal * Math.sin(yawRadians),
    target.y + vertical,
    target.z + horizontal * Math.cos(yawRadians),
  )
  return output
}

export const computeRagnarokPitchTarget = (tiltPsx: number) =>
  (RAGNAROK_CAMERA_PITCH_BASE_PSX + tiltPsx / RAGNAROK_CAMERA_TILT_DIVISOR) * PSX_ANGLE_TO_RAD

export const stepPitchManual = (
  pitchRadians: number,
  pitchInput: number,
  speedRadiansPerSecond: number,
  deltaSeconds: number,
  minRadians: number,
  maxRadians: number,
) => MathUtils.clamp(pitchRadians - pitchInput * speedRadiansPerSecond * deltaSeconds, minRadians, maxRadians)

export const stepPitchTowardTarget = (
  pitchRadians: number,
  targetRadians: number,
  stepRadiansPerSecond: number,
  deltaSeconds: number,
) => stepToward(pitchRadians, targetRadians, stepRadiansPerSecond * deltaSeconds)

export const stepZoom = (zoom: number, targetZoom: number, stepPerSecond: number, deltaSeconds: number) =>
  stepToward(zoom, targetZoom, stepPerSecond * deltaSeconds)

export const applyForwardLead = (target: Vector3, yawRadians: number, leadWorld: number) => {
  target.x -= Math.sin(yawRadians) * leadWorld
  target.z -= Math.cos(yawRadians) * leadWorld
  return target
}
