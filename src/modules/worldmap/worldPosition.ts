import { MathUtils } from 'three'

import {
  SEGMENT_WORLD_SIZE,
  TILE_WORLD_SIZE,
  WORLD_DEPTH_PSX,
  WORLD_GRID_COLS,
  WORLD_WIDTH_PSX,
  WORLDMAP_SCALE,
} from './constants'
import { WorldPosition } from './types'

export const buildWorldPosition = (threeX: number, threeZ: number): WorldPosition => {
  const psxX = MathUtils.euclideanModulo(threeX / WORLDMAP_SCALE, WORLD_WIDTH_PSX)
  const psxY = MathUtils.euclideanModulo(threeZ / WORLDMAP_SCALE, WORLD_DEPTH_PSX)
  const segmentX = Math.floor(psxX / SEGMENT_WORLD_SIZE)
  const segmentY = Math.floor(psxY / SEGMENT_WORLD_SIZE)
  return {
    psxX,
    psxY,
    regionId: segmentY * WORLD_GRID_COLS + segmentX,
    segmentX,
    segmentY,
    subSegmentX: Math.floor(psxX) % SEGMENT_WORLD_SIZE,
    subSegmentY: Math.floor(psxY) % SEGMENT_WORLD_SIZE,
    tileX: Math.floor(psxX / TILE_WORLD_SIZE),
    tileY: Math.floor(psxY / TILE_WORLD_SIZE),
  }
}
