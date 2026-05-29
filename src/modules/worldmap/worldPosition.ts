import { SEGMENT_WORLD_SIZE, WORLD_GRID_COLS, WORLD_GRID_ROWS, WORLDMAP_SCALE } from './constants'
import { WorldPosition } from './types'

const TILES_PER_SEGMENT = 4
const TILE_WORLD_SIZE = SEGMENT_WORLD_SIZE / TILES_PER_SEGMENT
const WORLD_X_TOTAL = WORLD_GRID_COLS * SEGMENT_WORLD_SIZE
const WORLD_Y_TOTAL = WORLD_GRID_ROWS * SEGMENT_WORLD_SIZE

export const positiveModulo = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus

export const buildWorldPosition = (threeX: number, threeZ: number): WorldPosition => {
  const psxX = positiveModulo(threeX / WORLDMAP_SCALE, WORLD_X_TOTAL)
  const psxY = positiveModulo(threeZ / WORLDMAP_SCALE, WORLD_Y_TOTAL)
  const segmentX = Math.floor(psxX / SEGMENT_WORLD_SIZE)
  const segmentY = Math.floor(psxY / SEGMENT_WORLD_SIZE)
  const tileX = Math.floor(psxX / TILE_WORLD_SIZE)
  const tileY = Math.floor(psxY / TILE_WORLD_SIZE)
  return {
    psxX,
    psxY,
    regionId: segmentY * WORLD_GRID_COLS + segmentX,
    segmentX,
    segmentY,
    subSegmentX: Math.floor(psxX) % SEGMENT_WORLD_SIZE,
    subSegmentY: Math.floor(psxY) % SEGMENT_WORLD_SIZE,
    tileX,
    tileY,
  }
}
