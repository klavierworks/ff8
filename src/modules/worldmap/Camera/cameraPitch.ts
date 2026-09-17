import { MathUtils } from 'three'

import {
  WORLDMAP_CAMERA_MODE_DEFAULT,
  WORLDMAP_PITCH_DEFAULT,
  WORLDMAP_PITCH_DIP_LIMIT,
  WORLDMAP_PITCH_DIP_STEP,
  WORLDMAP_PITCH_HOLD_MOVE_COST,
  WORLDMAP_PITCH_HOLD_THROTTLE_COST,
  WORLDMAP_PITCH_HOLD_TICKS,
  WORLDMAP_PITCH_HOLD_TURN_COST,
  WORLDMAP_PITCH_RAGNAROK_EASE_STEP,
  WORLDMAP_PITCH_RECOVER_STEP,
} from '../../../constants/worldmapCamera'
import { isCarOrGarden, isWalkerClass } from '../vehicleClasses'
import { stepTowards } from './cameraRig'

type PitchStep = {
  holdTicks: number
  pitch: number
}

type TerrainPitchInput = {
  isMoving: boolean
  isOccluded: boolean
  isStandingInCanopy: boolean
  isThrottling: boolean
  isTurning: boolean
}

export const hasTerrainPitchDip = (vehicleId: number, cameraModeIndex: number) =>
  (isWalkerClass(vehicleId) && cameraModeIndex === WORLDMAP_CAMERA_MODE_DEFAULT) || isCarOrGarden(vehicleId)

const dipPitch = (pitch: number) => MathUtils.clamp(pitch - WORLDMAP_PITCH_DIP_STEP, WORLDMAP_PITCH_DIP_LIMIT, 0)

const calculateDipOrRecovery = (pitch: number, holdTicks: number, input: TerrainPitchInput): PitchStep => {
  if (input.isStandingInCanopy) {
    return { holdTicks, pitch: dipPitch(pitch) }
  }
  if (input.isOccluded) {
    return { holdTicks: WORLDMAP_PITCH_HOLD_TICKS, pitch: dipPitch(pitch) }
  }
  if (holdTicks <= 0 && pitch < WORLDMAP_PITCH_DEFAULT) {
    return { holdTicks: holdTicks - 1, pitch: pitch + WORLDMAP_PITCH_RECOVER_STEP }
  }
  return { holdTicks, pitch }
}

const calculateHoldCost = ({ isMoving, isThrottling, isTurning }: TerrainPitchInput) =>
  (isMoving ? WORLDMAP_PITCH_HOLD_MOVE_COST : 0) +
  (isThrottling ? WORLDMAP_PITCH_HOLD_THROTTLE_COST : 0) +
  (isTurning ? WORLDMAP_PITCH_HOLD_TURN_COST : 0)

export const stepTerrainPitch = (pitch: number, holdTicks: number, input: TerrainPitchInput): PitchStep => {
  const step = calculateDipOrRecovery(pitch, holdTicks, input)
  return { ...step, holdTicks: step.holdTicks - calculateHoldCost(input) }
}

export const easeRagnarokPitch = (pitch: number, target: number) =>
  stepTowards(pitch, target, WORLDMAP_PITCH_RAGNAROK_EASE_STEP)
