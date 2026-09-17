import { MathUtils } from 'three'

import {
  AUTOPILOT_ARRIVAL_RANGE_X,
  AUTOPILOT_ARRIVAL_RANGE_Z,
  AUTOPILOT_CAMERA_LAG_RANGE,
  AUTOPILOT_HEADING_SPEED_SHIFT,
  AUTOPILOT_NEAR_CELL_RANGE,
  AUTOPILOT_THROTTLE_DISTANCE_SHIFT,
  AUTOPILOT_TURN_DEAD_ZONE,
  AUTOPILOT_TURN_GAIN,
} from '../../../../constants/worldmapAutopilot'
import { DRIVING_INPUT_MAGNITUDE, RAGNAROK_DRIVING } from '../../../../constants/worldmapVehicles'
import { WORLD_DEPTH_PSX, WORLD_TILE_COLUMNS, WORLD_TILE_ROWS, WORLD_WIDTH_PSX, WORLDMAP_SCALE } from '../../constants'
import { getMapCellFromWorld, MapCell } from '../../Minimap/minimapUtils'
import { DrivingInput } from '../drivingUtils'
import { calculateOffsetHeading, shortestPsxDelta } from '../playerAngles'
import { ShipPose } from '../shipPose'
import { AutopilotTarget } from './ragnarokState'

export type AutopilotCommand = {
  input: DrivingInput
  isStopRequested: boolean
  targetHeading: number
}

type AutopilotRequest = {
  isCancelPressed: boolean
  pose: ShipPose
  shipYaw: number
  target: AutopilotTarget
}

type MapOffset = {
  dx: number
  dz: number
}

const wrapSignedDelta = (delta: number, span: number) => MathUtils.euclideanModulo(delta + span / 2, span) - span / 2

const clampInput = (value: number) => MathUtils.clamp(value, -DRIVING_INPUT_MAGNITUDE, DRIVING_INPUT_MAGNITUDE)

const getShipCell = (pose: ShipPose) => getMapCellFromWorld(pose.x * WORLDMAP_SCALE, pose.z * WORLDMAP_SCALE)

const calculateCellOffset = (shipCell: MapCell, targetCell: MapCell): MapOffset => ({
  dx: wrapSignedDelta(targetCell.cellX - shipCell.cellX, WORLD_TILE_COLUMNS),
  dz: wrapSignedDelta(targetCell.cellY - shipCell.cellY, WORLD_TILE_ROWS),
})

const calculateTargetOffset = (pose: ShipPose, target: AutopilotTarget): MapOffset => ({
  dx: wrapSignedDelta(target.x - pose.x, WORLD_WIDTH_PSX),
  dz: wrapSignedDelta(target.z - pose.z, WORLD_DEPTH_PSX),
})

const isNearTargetCell = ({ dx, dz }: MapOffset) =>
  Math.abs(dx) < AUTOPILOT_NEAR_CELL_RANGE && Math.abs(dz) < AUTOPILOT_NEAR_CELL_RANGE

const isWithinArrivalRange = ({ dx, dz }: MapOffset) =>
  Math.abs(dx) < AUTOPILOT_ARRIVAL_RANGE_X && Math.abs(dz) < AUTOPILOT_ARRIVAL_RANGE_Z

const calculateApproachThrottle = ({ dx, dz }: MapOffset) =>
  Math.min((Math.abs(dx) + Math.abs(dz)) >> AUTOPILOT_THROTTLE_DISTANCE_SHIFT, DRIVING_INPUT_MAGNITUDE)

const calculateHeadingError = (shipYaw: number, targetHeading: number, isStopRequested: boolean) =>
  isStopRequested ? 0 : shortestPsxDelta(shipYaw, targetHeading)

const calculateAutopilotTurn = (headingError: number) =>
  Math.abs(headingError) < AUTOPILOT_TURN_DEAD_ZONE ? 0 : clampInput(-AUTOPILOT_TURN_GAIN * headingError)

const buildCommand = (
  offset: MapOffset,
  throttle: number,
  isStopRequested: boolean,
  shipYaw: number,
): AutopilotCommand => {
  const targetHeading = calculateOffsetHeading(offset.dx, offset.dz)
  const turn = calculateAutopilotTurn(calculateHeadingError(shipYaw, targetHeading, isStopRequested))
  return { input: { altitude: 0, throttle, turn }, isStopRequested, targetHeading }
}

export const calculateAutopilotCommand = ({ isCancelPressed, pose, shipYaw, target }: AutopilotRequest) => {
  const cellOffset = calculateCellOffset(getShipCell(pose), target.cell)
  if (!isNearTargetCell(cellOffset)) {
    return buildCommand(cellOffset, DRIVING_INPUT_MAGNITUDE, isCancelPressed, shipYaw)
  }
  const targetOffset = calculateTargetOffset(pose, target)
  const hasArrived = isWithinArrivalRange(targetOffset)
  const throttle = hasArrived ? DRIVING_INPUT_MAGNITUDE : calculateApproachThrottle(targetOffset)
  return buildCommand(targetOffset, throttle, isCancelPressed || hasArrived, shipYaw)
}

export const calculateAutopilotSpeedCap = ({ isStopRequested, targetHeading }: AutopilotCommand, shipYaw: number) =>
  RAGNAROK_DRIVING.topSpeed -
  Math.abs(calculateHeadingError(shipYaw, targetHeading, isStopRequested) >> AUTOPILOT_HEADING_SPEED_SHIFT)

export const calculateAutopilotRotateInput = (shipYaw: number, cameraYaw: number) => {
  const lag = shortestPsxDelta(cameraYaw, shipYaw)
  if (lag > AUTOPILOT_CAMERA_LAG_RANGE) {
    return -1
  }
  return lag < -AUTOPILOT_CAMERA_LAG_RANGE ? 1 : 0
}
