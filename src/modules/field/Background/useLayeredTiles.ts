import { useMemo } from 'react'
import { Texture } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import { sendToDebugger } from '../../../Debugger/debugUtils'
import { getLayerIdFromTile, TILE_BLENDS_TO_THREEJS, TILE_PADDING, TILE_SIZE, TILES_PER_COLUMN } from './tileUtils'
import useTilesTexture from './useTilesTexture'

const initialiseLayer = (tile: Tile, width: number, height: number, layerRenderID: number): Layer => {
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    console.error('Could not get 2D context from canvas')
    throw new Error('Could not get 2D context from canvas')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  const blendType = TILE_BLENDS_TO_THREEJS[tile.blendType as keyof typeof TILE_BLENDS_TO_THREEJS]

  return {
    blendType,
    canvas,
    id: getLayerIdFromTile(tile),
    isScreenLocked: false,
    layerID: tile.layerID,
    parameter: tile.parameter === 255 ? -1 : tile.parameter,
    renderID: layerRenderID,
    state: tile.state,
    z: tile.Z,
  }
}

const drawTile = (tile: Tile, canvas: HTMLCanvasElement, texture: Texture) => {
  const column = Math.floor(tile.index / TILES_PER_COLUMN)
  const row = tile.index % TILES_PER_COLUMN

  const sourceX = column * (TILE_SIZE + TILE_PADDING)
  const sourceY = row * (TILE_SIZE + TILE_PADDING)

  const context = canvas.getContext('2d')

  if (!context) {
    console.error('Could not get 2D context from canvas')
    return
  }

  context.imageSmoothingEnabled = false

  const posX = tile.X + canvas.width / 2
  const posY = tile.Y + canvas.height / 2

  context.drawImage(
    texture.image as HTMLImageElement,
    sourceX,
    sourceY,
    TILE_SIZE,
    TILE_SIZE,
    posX,
    posY,
    TILE_SIZE,
    TILE_SIZE,
  )

  return {
    posX,
    posY,
  }
}

const useLayeredTiles = (tiles: Tile[], filename: string, width: number, height: number) => {
  const tilesTexture = useTilesTexture(filename)

  const layers = useMemo(() => {
    const result: Record<string, Layer> = {}

    tiles.forEach((tile) => {
      const layerId = getLayerIdFromTile(tile)

      let layerRenderIDs = tiles.map((tile) => tile.layerID)
      layerRenderIDs = layerRenderIDs.filter((id, index) => layerRenderIDs.indexOf(id) === index).sort((a, b) => a - b)

      if (layerRenderIDs[0] !== 0) {
        layerRenderIDs.unshift(0)
      }
      if (!result[layerId]) {
        result[layerId] = initialiseLayer(tile, width, height, layerRenderIDs.indexOf(tile.layerID))
      }

      const { canvas } = result[layerId]

      const drawResult = drawTile(tile, canvas, tilesTexture)
      if (!drawResult) {
        console.error('Failed to draw tile')
        return
      }
    })

    const extentByLayerID: Record<number, { maxX: number; maxY: number; minX: number; minY: number }> = {}
    tiles.forEach((tile) => {
      const current = extentByLayerID[tile.layerID] ?? {
        maxX: -Infinity,
        maxY: -Infinity,
        minX: Infinity,
        minY: Infinity,
      }
      extentByLayerID[tile.layerID] = {
        maxX: Math.max(current.maxX, tile.X + TILE_SIZE),
        maxY: Math.max(current.maxY, tile.Y + TILE_SIZE),
        minX: Math.min(current.minX, tile.X),
        minY: Math.min(current.minY, tile.Y),
      }
    })

    Object.values(result).forEach((layer) => {
      const extent = extentByLayerID[layer.layerID]
      if (!extent) {
        return
      }
      layer.isScreenLocked = extent.maxX - extent.minX <= SCREEN_WIDTH && extent.maxY - extent.minY <= SCREEN_HEIGHT
    })

    const sortedLayers = Object.values(result).sort((a, b) => {
      if (a.z !== b.z) {
        return a.z - b.z
      }
      if (a.layerID !== b.layerID) {
        return a.layerID - b.layerID
      }
      return a.parameter - b.parameter
    })

    sortedLayers.forEach((layer, index) => {
      const { canvas, ...rest } = layer
      canvas.toBlob((blob) => {
        sendToDebugger('layers', JSON.stringify({ ...rest, index }), blob ?? undefined)
      })
    })
    return sortedLayers
  }, [height, tiles, tilesTexture, width])

  return layers
}

export default useLayeredTiles
