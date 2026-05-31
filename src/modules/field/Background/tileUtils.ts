import { AdditiveBlending, NoBlending, NormalBlending, SubtractiveBlending } from 'three'

export const TILE_SIZE = 16
export const TILE_PADDING = 4
export const TILES_PER_COLUMN = 64

export const TILE_BLENDS_TO_THREEJS = {
  0: NormalBlending,
  1: AdditiveBlending,
  2: SubtractiveBlending,
  3: AdditiveBlending,
  4: NoBlending,
}

export const getLayerIdFromTile = (tile: Tile) => {
  return `${tile.layerID}-${tile.blendType}-${tile.parameter}-${tile.state}`
}
