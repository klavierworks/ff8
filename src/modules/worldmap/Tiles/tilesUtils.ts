import { Box3, BufferAttribute, BufferGeometry, Mesh, Object3D } from 'three'

import { loadAssetUrl, preloadAssetUrl } from '../../../loadAssetUrl'
import { SEGMENT_SIZE_THREE, SEGMENT_WORLD_SIZE, WORLD_GRID_COLS, WORLD_GRID_ROWS } from '../constants'
import { positiveModulo } from '../worldPosition'
import { getTilesState, VARIANT_STAGING_ROW } from './tileState'

// Lazy glob: only the tiles actually rendered are fetched, not the whole world.
const TILE_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/tiles/*.glb', {
  import: 'default',
  query: '?url',
})

const tileKeyPath = (segmentIndex: number | undefined, variantIndex: number | undefined): string => {
  const name =
    segmentIndex !== undefined
      ? `segment_${String(segmentIndex).padStart(3, '0')}`
      : `variant_${String(variantIndex).padStart(3, '0')}`
  return `/extractor/data/converted/worldmap/tiles/${name}.glb`
}

// Suspends (call inside a Suspense boundary, e.g. before useGLTF).
export const getTileUrl = (segmentIndex: number | undefined, variantIndex: number | undefined): string =>
  loadAssetUrl(TILE_LOADERS, tileKeyPath(segmentIndex, variantIndex))

// Non-suspending; for preloading outside of render.
export const preloadTileUrl = (
  segmentIndex: number | undefined,
  variantIndex: number | undefined,
  onReady: (url: string) => void,
) => preloadAssetUrl(TILE_LOADERS, tileKeyPath(segmentIndex, variantIndex), onReady)

const SAVEMAP_WORLD_STATE_BYTE = 266
const SAVEMAP_PRISON_FLAG_BYTE = 264
const SAVEMAP_PRISON_ABOVE_GROUND_MASK = 0x08

export const getWorldStateVariable = (memory: Record<number, number>) => memory[SAVEMAP_WORLD_STATE_BYTE]

export const isDDistrictPrisonAboveGround = (memory: Record<number, number>): boolean =>
  (memory[SAVEMAP_PRISON_FLAG_BYTE] & SAVEMAP_PRISON_ABOVE_GROUND_MASK) !== 0

type BakedPosition = { column: number; row: number }

type TileOffset = [number, number, number]

type VisibleTile = (
  | { kind: 'segment'; offset: TileOffset; segmentIndex: number }
  | { kind: 'variant'; offset: TileOffset; variantIndex: number }
) & {
  targetColumn: number
  targetRow: number
}

export const getSegmentBakedPosition = (segmentIndex: number): BakedPosition => ({
  column: segmentIndex % WORLD_GRID_COLS,
  row: Math.floor(segmentIndex / WORLD_GRID_COLS),
})

export const getVariantBakedPosition = (variantIndex: number): BakedPosition => ({
  column: variantIndex % WORLD_GRID_COLS,
  row: VARIANT_STAGING_ROW + Math.floor(variantIndex / WORLD_GRID_COLS),
})

const getTileOffset = (targetColumn: number, targetRow: number, baked: BakedPosition): TileOffset => [
  (targetColumn - baked.column) * SEGMENT_WORLD_SIZE,
  0,
  (targetRow - baked.row) * SEGMENT_WORLD_SIZE,
]

export const positionToSegmentColumn = (worldX: number) => Math.floor(worldX / SEGMENT_SIZE_THREE)
export const positionToSegmentRow = (worldZ: number) => Math.floor(worldZ / SEGMENT_SIZE_THREE)

export const buildVariantOverrides = (
  worldStateVariable: number,
  isPrisonAboveGround: boolean,
): ReadonlyMap<number, number> => {
  const overrides = new Map<number, number>()
  getTilesState(worldStateVariable, isPrisonAboveGround).forEach(({ segmentIndex, variantIndex }) => {
    overrides.set(segmentIndex, variantIndex)
  })
  return overrides
}

export const computeVisibleTiles = (
  playerColumn: number,
  playerRow: number,
  radius: number,
  variantOverrides: ReadonlyMap<number, number>,
): VisibleTile[] => {
  const tiles: VisibleTile[] = []
  for (let deltaRow = -radius; deltaRow <= radius; deltaRow++) {
    for (let deltaColumn = -radius; deltaColumn <= radius; deltaColumn++) {
      const targetColumn = playerColumn + deltaColumn
      const targetRow = playerRow + deltaRow

      const wrappedColumn = positiveModulo(targetColumn, WORLD_GRID_COLS)
      const wrappedRow = positiveModulo(targetRow, WORLD_GRID_ROWS)
      const segmentIndex = wrappedRow * WORLD_GRID_COLS + wrappedColumn

      const variantIndex = variantOverrides.get(segmentIndex)
      const baked =
        variantIndex !== undefined ? getVariantBakedPosition(variantIndex) : getSegmentBakedPosition(segmentIndex)
      const offset = getTileOffset(targetColumn, targetRow, baked)

      tiles.push(
        variantIndex !== undefined
          ? { kind: 'variant', offset, targetColumn, targetRow, variantIndex }
          : { kind: 'segment', offset, segmentIndex, targetColumn, targetRow },
      )
    }
  }
  return tiles
}

export const tileKey = (tile: VisibleTile) => `${tile.targetColumn}/${tile.targetRow}`

const SEAM_EXPANSION_PSX = 1
const SEAM_BOUNDARY_TOLERANCE = 0.5
const SEAMS_EXPANDED_FLAG = 'seamsExpanded'

const expandGeometryToTileBounds = (geometry: BufferGeometry, tileBounds: Box3) => {
  const positions = geometry.getAttribute('position')
  if (!(positions instanceof BufferAttribute)) {
    return
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    if (Math.abs(x - tileBounds.min.x) < SEAM_BOUNDARY_TOLERANCE) {
      positions.setX(i, x - SEAM_EXPANSION_PSX)
    } else if (Math.abs(x - tileBounds.max.x) < SEAM_BOUNDARY_TOLERANCE) {
      positions.setX(i, x + SEAM_EXPANSION_PSX)
    }
    if (Math.abs(z - tileBounds.min.z) < SEAM_BOUNDARY_TOLERANCE) {
      positions.setZ(i, z - SEAM_EXPANSION_PSX)
    } else if (Math.abs(z - tileBounds.max.z) < SEAM_BOUNDARY_TOLERANCE) {
      positions.setZ(i, z + SEAM_EXPANSION_PSX)
    }
  }
  positions.needsUpdate = true
}

// Intentionally mutates the shared cached GLTF scene in place. This is the source loaded by
// useGLTF, shared across every clone of this tile; the SEAMS_EXPANDED_FLAG makes the edit
// idempotent so repeated callers (Tile + TilePrecompiler) never double-expand the same seam.
export const expandTileSeams = (scene: Object3D) => {
  if (scene.userData[SEAMS_EXPANDED_FLAG]) {
    return
  }
  const tileBounds = new Box3()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    object.geometry.computeBoundingBox()
    if (object.geometry.boundingBox) {
      tileBounds.union(object.geometry.boundingBox)
    }
  })
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      expandGeometryToTileBounds(object.geometry, tileBounds)
    }
  })
  scene.userData[SEAMS_EXPANDED_FLAG] = true
}
