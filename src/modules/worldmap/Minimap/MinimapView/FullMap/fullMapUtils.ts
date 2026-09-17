import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../../constants/constants'
import { TILE_WORLD_SIZE, WORLDMAP_SCALE } from '../../../constants'
import { ScriptSection } from '../../../Scripts/runScript'
import { findLastBodyOpcode } from '../../../Scripts/sectionRunners'
import { getEntity, WORLDMAP_STATE } from '../../../Scripts/state'
import { buildWorldPosition } from '../../../worldPosition'
import {
  BYTE_MASK,
  FULL_MAP_LEFT,
  FULL_MAP_TOP,
  MAP_PIXELS_PER_CELL,
  VEHICLE_MARKER_ENTITY_SLOTS,
  WORLD_MAP_TEXTURE_HEIGHT,
  WORLD_MAP_TEXTURE_WIDTH,
} from '../../constants'
import { getMapCellFromPsx, MapCell } from '../../minimapUtils'
import { createFlatRectsGeometry, createPsxMaterial, createPsxQuadGeometry, createRect } from '../psxPrimitives'

export type DestinationRecord = WorldmapSections['section_30_animation_descriptors']['records'][number]

export type MapPixel = {
  x: number
  y: number
}

export const createBackdropGeometry = () => createFlatRectsGeometry([createRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)])

export const createBackdropMaterial = () => {
  const material = createPsxMaterial('opaque')
  material.uniforms.modulation.value.set(0, 0, 0)
  return material
}

export const createMapGeometry = () =>
  createPsxQuadGeometry(
    createRect(FULL_MAP_LEFT, FULL_MAP_TOP, WORLD_MAP_TEXTURE_WIDTH, WORLD_MAP_TEXTURE_HEIGHT),
    createRect(0, 0, WORLD_MAP_TEXTURE_WIDTH, WORLD_MAP_TEXTURE_HEIGHT),
  )

export const getMapCellOfPixel = ({ x, y }: MapPixel): MapCell => ({
  cellX: Math.floor(x / MAP_PIXELS_PER_CELL),
  cellY: Math.floor(y / MAP_PIXELS_PER_CELL),
})

export const getMapPixelOfCell = ({ cellX, cellY }: MapCell): MapPixel => ({
  x: cellX * MAP_PIXELS_PER_CELL,
  y: cellY * MAP_PIXELS_PER_CELL,
})

const buildCellPosition = ({ cellX, cellY }: MapCell) =>
  buildWorldPosition(cellX * TILE_WORLD_SIZE * WORLDMAP_SCALE, cellY * TILE_WORLD_SIZE * WORLDMAP_SCALE)

const readLocationIdAtCell = (section: ScriptSection, cell: MapCell) => {
  const lastOpcode = findLastBodyOpcode(section, buildCellPosition(cell))
  return lastOpcode === undefined ? undefined : lastOpcode.p1 & BYTE_MASK
}

export const findLocationIdAtCell = (section: ScriptSection, cell: MapCell) => {
  WORLDMAP_STATE.isTileMode = true
  try {
    return readLocationIdAtCell(section, cell)
  } finally {
    WORLDMAP_STATE.isTileMode = false
  }
}

export const findDestinationMarkers = (
  records: readonly DestinationRecord[],
  names: readonly string[],
  section: ScriptSection,
): readonly MapPixel[] =>
  records
    .filter((record) => !!names[record.location_id])
    .filter((record) => findLocationIdAtCell(section, getMapCellOfPixel(record)) === record.location_id)
    .map(({ x, y }) => ({ x, y }))

const getReservedEntityMapPixel = (slot: number) => {
  const entity = getEntity(WORLDMAP_STATE.reservedSlots[slot] ?? -1)
  return entity ? getMapPixelOfCell(getMapCellFromPsx(entity.positionX, entity.positionY)) : undefined
}

export const collectVehicleMarkers = (): readonly MapPixel[] =>
  VEHICLE_MARKER_ENTITY_SLOTS.map(getReservedEntityMapPixel).filter(
    (marker): marker is MapPixel => marker !== undefined,
  )
