import wm2fieldData from '@data/worldmap/wm2field.json'

import MAP_NAMES from '../../../constants/maps'

export type Wm2FieldEntry = {
  direction: number
  fieldId: number
  fieldName: (typeof MAP_NAMES)[number] | undefined
  x: number
  y: number
  z: number
}

const resolveFieldName = (fieldId: number) =>
  (MAP_NAMES as readonly string[])[fieldId] as (typeof MAP_NAMES)[number] | undefined

const TABLE: readonly Wm2FieldEntry[] = wm2fieldData.map((entry) => ({
  direction: entry.direction,
  fieldId: entry.fieldId,
  fieldName: resolveFieldName(entry.fieldId),
  x: entry.x,
  y: entry.y,
  z: entry.z,
}))

export const getWm2FieldTable = (): readonly Wm2FieldEntry[] => TABLE
