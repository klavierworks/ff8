import { MathUtils } from 'three'

import {
  CHARACTER_FOOTPRINT,
  COMPANION_ENTITY_TYPES,
  DRAW_POINT_ENTITY_TYPE,
  FIRST_WMSET_ENTITY_TYPE,
  FOOTPRINT_SHAPE_NONE,
  FOOTPRINT_SHAPE_WIDE,
  RAGNAROK_ENTITY_TYPE,
  RAGNAROK_FOOTPRINT,
  WMSET_ENTITY_FOOTPRINTS,
} from '../../../constants/worldmapEntities'
import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX } from '../constants'
import { EntityRecord } from '../Scripts/state'

export type CollisionBox = {
  altitude: number
  halfSize: number
  height: number
  x: number
  y: number
}

type CollisionQuery = {
  box: CollisionBox
  excludedIndices: readonly number[]
  isHeightIgnored: boolean
  reach: number
}

type Footprint = {
  depth: number
  height: number
  shape: number
  width: number
}

const TYPE_SHARING_RAGNAROK_FOOTPRINT = FIRST_WMSET_ENTITY_TYPE + WMSET_ENTITY_FOOTPRINTS.length

const getEntityFootprint = (typeCode: number): Footprint | undefined => {
  if (typeCode === RAGNAROK_ENTITY_TYPE || typeCode === TYPE_SHARING_RAGNAROK_FOOTPRINT) {
    return RAGNAROK_FOOTPRINT
  }
  if (typeCode < FIRST_WMSET_ENTITY_TYPE) {
    return CHARACTER_FOOTPRINT
  }
  return WMSET_ENTITY_FOOTPRINTS[typeCode - FIRST_WMSET_ENTITY_TYPE]
}

export const calculateFootprintRadius = ({ depth, shape, width }: Footprint) =>
  shape === FOOTPRINT_SHAPE_WIDE ? Math.max(width, depth >> 1) : Math.max(width >> 1, depth >> 1)

export const wrapDelta = (delta: number, size: number) => {
  const wrapped = MathUtils.euclideanModulo(delta, size)
  return wrapped > size / 2 ? wrapped - size : wrapped
}

const isEntityExcluded = (entity: EntityRecord, index: number, excludedIndices: readonly number[]) =>
  excludedIndices.includes(index) ||
  entity.typeCode === DRAW_POINT_ENTITY_TYPE ||
  (COMPANION_ENTITY_TYPES as readonly number[]).includes(entity.typeCode)

const isHeightOverlapping = (box: CollisionBox, entity: EntityRecord, footprint: Footprint, reach: number) =>
  box.altitude - box.height <= entity.positionVerticalY + reach &&
  box.altitude >= entity.positionVerticalY - footprint.height - reach

const isWithinReach = (box: CollisionBox, entity: EntityRecord, footprint: Footprint, reach: number) => {
  const deltaX = wrapDelta(entity.positionX - box.x, WORLD_WIDTH_PSX)
  const deltaY = wrapDelta(entity.positionY - box.y, WORLD_DEPTH_PSX)
  const limit = calculateFootprintRadius(footprint) + box.halfSize + reach
  return deltaX * deltaX + deltaY * deltaY <= limit * limit
}

const isEntityHit = (entity: EntityRecord, query: CollisionQuery) => {
  const footprint = getEntityFootprint(entity.typeCode)
  if (!footprint || footprint.shape === FOOTPRINT_SHAPE_NONE) {
    return false
  }
  if (!query.isHeightIgnored && !isHeightOverlapping(query.box, entity, footprint, query.reach)) {
    return false
  }
  return isWithinReach(query.box, entity, footprint, query.reach)
}

export const findCollidingEntity = (entities: readonly EntityRecord[], query: CollisionQuery) =>
  entities.findIndex(
    (entity, index) => !isEntityExcluded(entity, index, query.excludedIndices) && isEntityHit(entity, query),
  )

export const getEntityFootprintHeight = (typeCode: number) => getEntityFootprint(typeCode)?.height ?? 0

export const getEntityFootprintRadius = (typeCode: number) => {
  const footprint = getEntityFootprint(typeCode)
  return footprint ? calculateFootprintRadius(footprint) : 0
}
