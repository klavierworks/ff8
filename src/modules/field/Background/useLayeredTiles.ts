import { useMemo } from 'react'

import { buildTileGroups } from './buildTileGroups'
import useTilesTexture from './useTilesTexture'

const useLayeredTiles = (tiles: Tile[], filename: string) => {
  const tilesTexture = useTilesTexture(filename)

  const layers = useMemo(() => {
    const image = tilesTexture.image as { height: number; width: number }
    return buildTileGroups(tiles, image.width, image.height)
  }, [tiles, tilesTexture])

  return { layers, texture: tilesTexture }
}

export default useLayeredTiles
