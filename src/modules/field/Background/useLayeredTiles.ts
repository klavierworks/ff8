import { useMemo } from 'react'

import useFieldSprite from '../useFieldSprite'
import { buildTileGroups } from './buildTileGroups'

const useLayeredTiles = (tiles: Tile[], fieldId: string, filename: string, layerWrap: LayerWrap[]) => {
  const tilesTexture = useFieldSprite(fieldId, filename)

  const layers = useMemo(() => {
    const image = tilesTexture.image as { height: number; width: number }
    console.log(image.width, image.height)
    return buildTileGroups(tiles, image.width, image.height, layerWrap)
  }, [layerWrap, tiles, tilesTexture])

  return { layers, texture: tilesTexture }
}

export default useLayeredTiles
