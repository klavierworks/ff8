import { VEHICLE_IDS } from '../../../constants/vehicles'
import {
  WORLDMAP_FOCUS_HEIGHT_ABOVE_PLAYER,
  WORLDMAP_GARDEN_FOCUS_ALTITUDE_LIMIT,
} from '../../../constants/worldmapCamera'
import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX } from '../constants'

export type PsxPoint = {
  altitude: number
  x: number
  z: number
}

const unwrapTowards = (focus: number, player: number, worldSize: number) => {
  const half = worldSize / 2
  if (focus - player > half) {
    return focus - worldSize
  }
  if (focus - player < -half) {
    return focus + worldSize
  }
  return focus
}

const followHorizontal = (focus: number, player: number, worldSize: number) =>
  Math.floor((player + unwrapTowards(focus, player, worldSize)) / 2)

const followAltitude = (focus: number, player: number) =>
  Math.floor((3 * focus + player - WORLDMAP_FOCUS_HEIGHT_ABOVE_PLAYER) / 4)

export const createInitialFocus = (player: PsxPoint): PsxPoint => ({
  altitude: player.altitude - WORLDMAP_FOCUS_HEIGHT_ABOVE_PLAYER,
  x: player.x,
  z: player.z,
})

export const stepFocus = (focus: PsxPoint, player: PsxPoint, isAltitudeHeld: boolean): PsxPoint => ({
  altitude: isAltitudeHeld ? focus.altitude : followAltitude(focus.altitude, player.altitude),
  x: followHorizontal(focus.x, player.x, WORLD_WIDTH_PSX),
  z: followHorizontal(focus.z, player.z, WORLD_DEPTH_PSX),
})

export const getRenderedFocusAltitude = (focus: PsxPoint, vehicleId: number) =>
  vehicleId === VEHICLE_IDS.BALAMB_GARDEN
    ? Math.min(focus.altitude, WORLDMAP_GARDEN_FOCUS_ALTITUDE_LIMIT)
    : focus.altitude
