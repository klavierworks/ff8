import { BufferAttribute, BufferGeometry } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import { getLayerIdFromTile, TILE_BLENDS_TO_THREEJS, TILE_PADDING, TILE_SIZE, TILES_PER_COLUMN } from './tileUtils'

type LayerExtent = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

const getLayerExtents = (tiles: Tile[]) => {
  const extents: Record<number, LayerExtent> = {}

  tiles.forEach((tile) => {
    const current = extents[tile.layerID] ?? { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity }
    extents[tile.layerID] = {
      maxX: Math.max(current.maxX, tile.X + TILE_SIZE),
      maxY: Math.max(current.maxY, tile.Y + TILE_SIZE),
      minX: Math.min(current.minX, tile.X),
      minY: Math.min(current.minY, tile.Y),
    }
  })

  return extents
}

const UV_INSET = 0.5

const getTileSourceUV = (index: number, atlasWidth: number, atlasHeight: number) => {
  const column = Math.floor(index / TILES_PER_COLUMN)
  const row = index % TILES_PER_COLUMN

  const sourceX = column * (TILE_SIZE + TILE_PADDING)
  const sourceY = row * (TILE_SIZE + TILE_PADDING)

  return {
    u0: (sourceX + UV_INSET) / atlasWidth,
    u1: (sourceX + TILE_SIZE - UV_INSET) / atlasWidth,
    v0: 1 - (sourceY + UV_INSET) / atlasHeight,
    v1: 1 - (sourceY + TILE_SIZE - UV_INSET) / atlasHeight,
  }
}

const buildGroupGeometry = (groupTiles: Tile[], atlasWidth: number, atlasHeight: number) => {
  const count = groupTiles.length

  const positions = new Float32Array(count * 12)
  const uvs = new Float32Array(count * 8)
  const indices = new Uint32Array(count * 6)
  const tilePositions = new Float32Array(count * 2)
  const tileDepths = new Float32Array(count)

  groupTiles.forEach((tile, i) => {
    const { u0, u1, v0, v1 } = getTileSourceUV(tile.index, atlasWidth, atlasHeight)

    const uvOffset = i * 8
    uvs[uvOffset] = u0
    uvs[uvOffset + 1] = v0
    uvs[uvOffset + 2] = u1
    uvs[uvOffset + 3] = v0
    uvs[uvOffset + 4] = u1
    uvs[uvOffset + 5] = v1
    uvs[uvOffset + 6] = u0
    uvs[uvOffset + 7] = v1

    const vertexOffset = i * 4
    const indexOffset = i * 6
    indices[indexOffset] = vertexOffset
    indices[indexOffset + 1] = vertexOffset + 1
    indices[indexOffset + 2] = vertexOffset + 2
    indices[indexOffset + 3] = vertexOffset
    indices[indexOffset + 4] = vertexOffset + 2
    indices[indexOffset + 5] = vertexOffset + 3

    tilePositions[i * 2] = tile.X
    tilePositions[i * 2 + 1] = tile.Y
    tileDepths[i] = tile.Z
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(new BufferAttribute(indices, 1))

  return { geometry, tileDepths, tilePositions }
}

const getRenderIdByLayerID = (tiles: Tile[]) => {
  const presentLayerIDs = Array.from(new Set(tiles.map((tile) => tile.layerID))).sort((a, b) => a - b)
  if (presentLayerIDs[0] !== 0) {
    presentLayerIDs.unshift(0)
  }
  const renderIdByLayerID: Record<number, number> = {}
  presentLayerIDs.forEach((layerID, index) => {
    renderIdByLayerID[layerID] = index
  })
  return renderIdByLayerID
}

export const buildTileGroups = (tiles: Tile[], atlasWidth: number, atlasHeight: number): Layer[] => {
  const extents = getLayerExtents(tiles)
  const renderIdByLayerID = getRenderIdByLayerID(tiles)

  const grouped: Record<string, Tile[]> = {}
  tiles.forEach((tile) => {
    const id = getLayerIdFromTile(tile)
    if (!grouped[id]) {
      grouped[id] = []
    }
    grouped[id].push(tile)
  })

  const layers = Object.entries(grouped).map(([id, groupTiles]) => {
    const sample = groupTiles[0]
    const extent = extents[sample.layerID]
    const wrapPeriodX = extent.maxX - extent.minX
    const wrapPeriodY = extent.maxY - extent.minY
    const isScreenLocked = wrapPeriodX <= SCREEN_WIDTH && wrapPeriodY <= SCREEN_HEIGHT
    const { geometry, tileDepths, tilePositions } = buildGroupGeometry(groupTiles, atlasWidth, atlasHeight)

    return {
      blendType: TILE_BLENDS_TO_THREEJS[sample.blendType as keyof typeof TILE_BLENDS_TO_THREEJS],
      geometry,
      id,
      isScreenLocked,
      layerID: sample.layerID,
      parameter: sample.parameter === 255 ? -1 : sample.parameter,
      renderID: renderIdByLayerID[sample.layerID],
      shouldWrapX: !isScreenLocked && wrapPeriodX >= SCREEN_WIDTH,
      shouldWrapY: !isScreenLocked && wrapPeriodY >= SCREEN_HEIGHT,
      state: sample.state,
      tileDepths,
      tilePositions,
      wrapPeriodX,
      wrapPeriodY,
    }
  })

  return layers.sort((a, b) => {
    if (a.layerID !== b.layerID) {
      return a.layerID - b.layerID
    }
    return a.parameter - b.parameter
  })
}

const wrapAroundCenter = (value: number, center: number, period: number) => {
  return value - period * Math.round((value - center) / period)
}

export const writeLayerPositions = (
  layer: Layer,
  cameraLength: number,
  fovHalfTan: number,
  offsetX: number,
  offsetY: number,
  centerX: number,
  centerY: number,
  shouldWrapX: boolean,
  shouldWrapY: boolean,
) => {
  const positionAttribute = layer.geometry.getAttribute('position')
  const positions = positionAttribute.array as Float32Array

  const { tileDepths, tilePositions, wrapPeriodX, wrapPeriodY } = layer
  const unitsPerPixelPerDepth = (2 * fovHalfTan) / SCREEN_HEIGHT

  for (let i = 0; i < tileDepths.length; i += 1) {
    const depth = (cameraLength * tileDepths[i]) / 1000
    const unitsPerPixel = unitsPerPixelPerDepth * depth

    let screenX = tilePositions[i * 2] + offsetX
    let screenY = tilePositions[i * 2 + 1] + offsetY
    if (shouldWrapX) {
      screenX = wrapAroundCenter(screenX, centerX, wrapPeriodX)
    }
    if (shouldWrapY) {
      screenY = wrapAroundCenter(screenY, centerY, wrapPeriodY)
    }

    const left = screenX * unitsPerPixel
    const right = (screenX + TILE_SIZE) * unitsPerPixel
    const top = -screenY * unitsPerPixel
    const bottom = -(screenY + TILE_SIZE) * unitsPerPixel
    const depthZ = -depth

    const offset = i * 12
    positions[offset] = left
    positions[offset + 1] = top
    positions[offset + 2] = depthZ
    positions[offset + 3] = right
    positions[offset + 4] = top
    positions[offset + 5] = depthZ
    positions[offset + 6] = right
    positions[offset + 7] = bottom
    positions[offset + 8] = depthZ
    positions[offset + 9] = left
    positions[offset + 10] = bottom
    positions[offset + 11] = depthZ
  }

  positionAttribute.needsUpdate = true
}
