import useCameraScroll from '../useScrollTransition'

export const TILE_SIZE = 16
export const TILE_PADDING = 4
export const TILES_PER_COLUMN = 64

export const getLayerIdFromTile = (tile: Tile) => {
  return `${tile.layerID}-${tile.blendType}-${tile.parameter}-${tile.state}`
}

export type LayerScrolls = Record<number, ReturnType<typeof useCameraScroll>>
