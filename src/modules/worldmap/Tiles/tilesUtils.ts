import { Material, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three'

import { loadAssetUrl, preloadAssetUrl } from '../../../loadAssetUrl'
import {
  SEGMENT_SIZE_THREE,
  SEGMENT_WORLD_SIZE,
  WALKMESH_USER_DATA_KEY,
  WORLD_GRID_COLS,
  WORLD_GRID_ROWS,
} from '../constants'
import { applyTerrainShaders } from '../terrainShaders'
import { VARIANT_STAGING_ROW } from './tileState'

export type SegmentPosition = {
  column: number
  row: number
}

export type TileOffset = [number, number, number]

type VisibleTile = {
  assetPath: string
  key: string
  offset: TileOffset
}

const TILE_DIRECTORY = '/extractor/data/converted/worldmap/tiles'

const TILE_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/tiles/*.glb', {
  import: 'default',
  query: '?url',
})

const SAVEMAP_PRISON_FLAG_BYTE = 264
const SAVEMAP_PRISON_ABOVE_GROUND_MASK = 0x08

export const getTileUrl = (assetPath: string) => loadAssetUrl(TILE_LOADERS, assetPath)

export const preloadTileUrl = (assetPath: string, onReady: (url: string) => void) =>
  preloadAssetUrl(TILE_LOADERS, assetPath, onReady)

export const isDDistrictPrisonAboveGround = (memory: Record<number, number>) =>
  ((memory[SAVEMAP_PRISON_FLAG_BYTE] ?? 0) & SAVEMAP_PRISON_ABOVE_GROUND_MASK) !== 0

export const getSegmentPosition = (position: Vector3): SegmentPosition => ({
  column: Math.floor(position.x / SEGMENT_SIZE_THREE),
  row: Math.floor(position.z / SEGMENT_SIZE_THREE),
})

const formatTileIndex = (index: number) => String(index).padStart(3, '0')

const getSegmentAssetPath = (segmentIndex: number) => `${TILE_DIRECTORY}/segment_${formatTileIndex(segmentIndex)}.glb`

const getVariantAssetPath = (variantIndex: number) => `${TILE_DIRECTORY}/variant_${formatTileIndex(variantIndex)}.glb`

const getSegmentBakedPosition = (segmentIndex: number): SegmentPosition => ({
  column: segmentIndex % WORLD_GRID_COLS,
  row: Math.floor(segmentIndex / WORLD_GRID_COLS),
})

const getVariantBakedPosition = (variantIndex: number): SegmentPosition => ({
  column: variantIndex % WORLD_GRID_COLS,
  row: VARIANT_STAGING_ROW + Math.floor(variantIndex / WORLD_GRID_COLS),
})

const getTileOffset = (target: SegmentPosition, baked: SegmentPosition): TileOffset => [
  (target.column - baked.column) * SEGMENT_WORLD_SIZE,
  0,
  (target.row - baked.row) * SEGMENT_WORLD_SIZE,
]

const getWrappedSegmentIndex = ({ column, row }: SegmentPosition) =>
  MathUtils.euclideanModulo(row, WORLD_GRID_ROWS) * WORLD_GRID_COLS + MathUtils.euclideanModulo(column, WORLD_GRID_COLS)

const createVisibleTile = (target: SegmentPosition, variantOverrides: ReadonlyMap<number, number>): VisibleTile => {
  const segmentIndex = getWrappedSegmentIndex(target)
  const variantIndex = variantOverrides.get(segmentIndex)
  const key = `${target.column}/${target.row}`
  if (variantIndex === undefined) {
    return {
      assetPath: getSegmentAssetPath(segmentIndex),
      key,
      offset: getTileOffset(target, getSegmentBakedPosition(segmentIndex)),
    }
  }
  return {
    assetPath: getVariantAssetPath(variantIndex),
    key,
    offset: getTileOffset(target, getVariantBakedPosition(variantIndex)),
  }
}

const createDeltaRange = (radius: number) => Array.from({ length: 2 * radius + 1 }, (_, i) => i - radius)

export const getTilesAround = (
  center: SegmentPosition,
  radius: number,
  variantOverrides: ReadonlyMap<number, number>,
) => {
  const deltas = createDeltaRange(radius)
  return deltas.flatMap((deltaRow) =>
    deltas.map((deltaColumn) =>
      createVisibleTile({ column: center.column + deltaColumn, row: center.row + deltaRow }, variantOverrides),
    ),
  )
}

export const getMeshMaterials = (mesh: Mesh): Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material]

export const getTextureMap = (material: Material) =>
  material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial ? material.map : null

const configureTileMaterial = (material: Material) => {
  applyTerrainShaders(material)
  if (!getTextureMap(material)) {
    return
  }
  material.alphaTest = 0.5
  material.transparent = false
  material.needsUpdate = true
}

const configureTileMesh = (object: Object3D) => {
  if (!(object instanceof Mesh)) {
    return
  }
  object.userData[WALKMESH_USER_DATA_KEY] = true
  object.frustumCulled = false
  getMeshMaterials(object).forEach(configureTileMaterial)
}

export const prepareTileScene = (scene: Object3D) => {
  scene.traverse(configureTileMesh)
  return scene
}
