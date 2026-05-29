import MAP_NAMES from '../../../constants/maps'

const TABLE_URL = '/worldmap/wm2field.tbl'
const ENTRY_SIZE = 24
const ENTRY_COUNT = 72

export type Wm2FieldEntry = {
  direction: number
  fieldId: number
  fieldName: (typeof MAP_NAMES)[number] | undefined
  x: number
  y: number
  z: number
}

const parseEntry = (view: DataView, index: number): Wm2FieldEntry => {
  const base = index * ENTRY_SIZE
  const fieldId = view.getUint16(base + 6, true)
  return {
    direction: view.getUint8(base + 8),
    fieldId,
    fieldName: (MAP_NAMES as readonly string[])[fieldId] as (typeof MAP_NAMES)[number] | undefined,
    x: view.getInt16(base + 0, true),
    y: view.getInt16(base + 2, true),
    z: view.getUint16(base + 4, true),
  }
}

const parseTable = (buffer: ArrayBuffer): readonly Wm2FieldEntry[] => {
  const view = new DataView(buffer)
  return Array.from({ length: ENTRY_COUNT }, (_, index) => parseEntry(view, index))
}

let cached: readonly Wm2FieldEntry[] | undefined
let inflight: Promise<readonly Wm2FieldEntry[]> | undefined

export const loadWm2FieldTable = (): Promise<readonly Wm2FieldEntry[]> => {
  if (cached) {
    return Promise.resolve(cached)
  }
  if (inflight) {
    return inflight
  }
  inflight = fetch(TABLE_URL)
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      cached = parseTable(buffer)
      return cached
    })
    .finally(() => {
      inflight = undefined
    })
  return inflight
}
