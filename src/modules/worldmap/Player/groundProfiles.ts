import {
  CAR_ACCESS_BIT,
  GARDEN_ACCESS_BIT,
  GARDEN_HOVER_HIGHEST_PSX,
  GARDEN_HOVER_LOWEST_PSX,
  GARDEN_HOVER_STEP_PSX,
  GARDEN_WATER_GROUND_MAX,
  GARDEN_WATER_GROUND_MIN,
  GARDEN_WATER_HOVER_OFFSET_PSX,
  VEHICLE_PROBE_OFFSET_PSX,
} from '../../../constants/worldmapVehicles'
import { ON_FOOT_ACCESS_BIT } from '../constants'
import { selectOnFootTriangle, selectTopTriangle, TerrainTriangle } from '../terrain'
import { SLIDE_PROBE_OFFSET_PSX } from './constants'
import { GroundProfile, GroundStepRequest } from './groundStep'

const selectReachableTriangle = (triangles: readonly TerrainTriangle[], request: GroundStepRequest) =>
  selectOnFootTriangle(triangles, request.currentPsxY, request.currentGroundType)

export const ON_FOOT_GROUND: GroundProfile = {
  accessBit: ON_FOOT_ACCESS_BIT,
  probeOffsetPsx: SLIDE_PROBE_OFFSET_PSX,
  selectTriangle: selectReachableTriangle,
}

export const CAR_GROUND: GroundProfile = {
  accessBit: CAR_ACCESS_BIT,
  probeOffsetPsx: VEHICLE_PROBE_OFFSET_PSX,
  selectTriangle: selectReachableTriangle,
}

export const GARDEN_GROUND: GroundProfile = {
  accessBit: GARDEN_ACCESS_BIT,
  probeOffsetPsx: VEHICLE_PROBE_OFFSET_PSX,
  selectTriangle: selectTopTriangle,
}

export const isGardenWaterGround = (groundType: number) =>
  groundType >= GARDEN_WATER_GROUND_MIN && groundType <= GARDEN_WATER_GROUND_MAX

export const stepGardenHoverHeight = (currentPsxY: number, triangle: TerrainTriangle) => {
  const offset = isGardenWaterGround(triangle.groundType) ? GARDEN_WATER_HOVER_OFFSET_PSX : 0
  const lowest = triangle.psxY - GARDEN_HOVER_LOWEST_PSX + offset
  const highest = triangle.psxY - GARDEN_HOVER_HIGHEST_PSX + offset
  const descended = highest > currentPsxY ? currentPsxY + GARDEN_HOVER_STEP_PSX : currentPsxY
  return lowest < descended ? descended - GARDEN_HOVER_STEP_PSX : descended
}
