import {
  Box3,
  BufferGeometry,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  Source,
  Sphere,
  Texture,
  Vector3,
} from 'three'

import { getAssetUrl } from '../../../assetManifest'
import { SEGMENT_SIZE_THREE, SEGMENT_WORLD_SIZE, WALKMESH_LAYER, WORLD_GRID_COLS, WORLD_GRID_ROWS } from '../constants'
import { calculateMaxCurvatureDropPsx } from '../curvature'
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

const TILE_DIRECTORY = 'worldmap/tiles'

const SAVEMAP_PRISON_FLAG_BYTE = 264
const SAVEMAP_PRISON_ABOVE_GROUND_MASK = 0x08

export const getTileUrl = (assetPath: string) => getAssetUrl(assetPath)

export const preloadTileUrl = (assetPath: string, onReady: (url: string) => void) => onReady(getAssetUrl(assetPath))

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
  material instanceof MeshStandardMaterial ||
  material instanceof MeshBasicMaterial ||
  material instanceof MeshLambertMaterial
    ? material.map
    : null

const sharedAtlasSources = new Map<string, Source>()

const releaseImage = (image: unknown) => {
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    image.close()
  }
}

// Every tile file decodes its own copy of each atlas, and the renderer uploads one GPU texture per Source.
const shareAtlasSource = (texture: null | Texture) => {
  if (!texture) {
    return
  }
  const shared = sharedAtlasSources.get(texture.name)
  if (!shared) {
    sharedAtlasSources.set(texture.name, texture.source)
    return
  }
  if (shared === texture.source) {
    return
  }
  releaseImage(texture.source.data)
  texture.source = shared
}

const createTileMaterial = (material: MeshStandardMaterial) => {
  shareAtlasSource(material.map)
  const tileMaterial = new MeshLambertMaterial({
    alphaTest: material.map ? 0.5 : 0,
    color: material.color,
    map: material.map,
    name: material.name,
    side: material.side,
  })
  applyTerrainShaders(tileMaterial)
  return tileMaterial
}

const convertTileMaterial = (material: Material) =>
  material instanceof MeshStandardMaterial ? createTileMaterial(material) : material

const readGeometryBounds = (geometry: BufferGeometry) => {
  geometry.computeBoundingBox()
  return geometry.boundingBox ?? new Box3()
}

const calculateCurvedTileBounds = (geometry: BufferGeometry) => {
  const { max, min } = readGeometryBounds(geometry)
  return new Box3(
    new Vector3(min.x, Math.min(min.y, 0) - calculateMaxCurvatureDropPsx(), min.z),
    new Vector3(max.x, Math.max(max.y, 0), max.z),
  )
}

const setCurvedTileBounds = (geometry: BufferGeometry) => {
  const bounds = calculateCurvedTileBounds(geometry)
  geometry.boundingBox = bounds
  geometry.boundingSphere = bounds.getBoundingSphere(new Sphere())
}

const configureTileMesh = (object: Object3D) => {
  if (!(object instanceof Mesh)) {
    return
  }
  object.layers.enable(WALKMESH_LAYER)
  object.material = Array.isArray(object.material)
    ? object.material.map(convertTileMaterial)
    : convertTileMaterial(object.material)
  setCurvedTileBounds(object.geometry)
}

export const prepareTileScene = (scene: Object3D) => {
  scene.traverse(configureTileMesh)
  return scene
}
