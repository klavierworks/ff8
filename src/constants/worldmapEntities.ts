// ─── Entity type codes ───
export const RAGNAROK_ENTITY_TYPE = 1
export const DRAW_POINT_ENTITY_TYPE = 94
export const COMPANION_ENTITY_TYPES = [2, 3] as const
export const FIRST_WMSET_ENTITY_TYPE = 64
export const WMSET_MODEL_COUNT = 32
export const UNTRACKED_GARDEN_ENTITY_TYPES = [64, 65] as const
export const ALTERNATE_SUBTYPE_ENTITY_TYPE = 80
export const ALTERNATE_ENTITY_SUBTYPE = 4
export const MAX_WORLDMAP_ENTITIES = 64

// ─── Entity interaction ───
export const TIGHT_CANDIDATE_DISTANCE = 200
export const LOOSE_CANDIDATE_DISTANCE = 600

// ─── Entity vehicle categories ───
export const ENTITY_VEHICLE_CATEGORIES = [
  { category: 0, typeCodes: [0] },
  { category: 1, typeCodes: [4] },
  { category: 2, typeCodes: [5] },
  { category: 6, typeCodes: [6] },
  { category: 32, typeCodes: [74, 75] },
  { category: 33, typeCodes: [73] },
  { category: 34, typeCodes: [81] },
  { category: 35, typeCodes: [82] },
  { category: 36, typeCodes: [83] },
  { category: 37, typeCodes: [84] },
  { category: 38, typeCodes: [85] },
  { category: 39, typeCodes: [86] },
  { category: 40, typeCodes: [87] },
  { category: 48, typeCodes: [64, 65] },
  { category: 49, typeCodes: [2, 3] },
  { category: 50, typeCodes: [1] },
  { category: 65, typeCodes: [77] },
  { category: 66, typeCodes: [78] },
  { category: 131, typeCodes: [70] },
] as const

// ─── Entity models ───
export const CHARAONE_SECTION_COUNT = 7
export const CHARAONE_MESH_SLOTS: ReadonlyMap<number, readonly number[]> = new Map([
  [0, [0, 1]],
  [1, [4, 5, 6, 7]],
  [2, [2, 3]],
  [3, [2, 3]],
  [4, [0, 1]],
  [5, [0, 1]],
  [6, [0, 1]],
])
export const ENTITY_PLACEHOLDER_SIZE = 240
export const ENTITY_PLACEHOLDER_COLOR = '#ff66cc'

// ─── Entity footprints ───
export const FOOTPRINT_SHAPE_NONE = 0
export const FOOTPRINT_SHAPE_WIDE = 2

export const RAGNAROK_FOOTPRINT = { depth: 1024, height: 520, shape: 3, width: 740 } as const
export const CHARACTER_FOOTPRINT = { depth: 96, height: 180, shape: 1, width: 96 } as const

export const WMSET_ENTITY_FOOTPRINTS = [
  { depth: 1023, height: 704, shape: 4, width: 1023 },
  { depth: 1023, height: 704, shape: 4, width: 1023 },
  { depth: 206, height: 261, shape: 2, width: 904 },
  { depth: 206, height: 215, shape: 2, width: 811 },
  { depth: 206, height: 261, shape: 2, width: 904 },
  { depth: 206, height: 215, shape: 2, width: 811 },
  { depth: 206, height: 233, shape: 2, width: 811 },
  { depth: 206, height: 197, shape: 2, width: 811 },
  { depth: 206, height: 197, shape: 2, width: 811 },
  { depth: 140, height: 200, shape: 1, width: 400 },
  { depth: 202, height: 120, shape: 1, width: 453 },
  { depth: 170, height: 209, shape: 1, width: 323 },
  { depth: 0, height: 0, shape: 0, width: 0 },
  { depth: 0, height: 0, shape: 0, width: 0 },
  { depth: 0, height: 0, shape: 0, width: 0 },
  { depth: 800, height: 704, shape: 1, width: 800 },
  { depth: 1644, height: 704, shape: 4, width: 1644 },
  { depth: 153, height: 200, shape: 1, width: 394 },
  { depth: 176, height: 200, shape: 1, width: 417 },
  { depth: 185, height: 200, shape: 1, width: 425 },
  { depth: 164, height: 200, shape: 1, width: 378 },
  { depth: 168, height: 200, shape: 1, width: 372 },
  { depth: 168, height: 200, shape: 1, width: 372 },
  { depth: 168, height: 200, shape: 1, width: 372 },
  { depth: 567, height: 212, shape: 1, width: 1704 },
  { depth: 2004, height: 3274, shape: 1, width: 2004 },
  { depth: 2004, height: 3274, shape: 1, width: 2004 },
  { depth: 2004, height: 3274, shape: 1, width: 2004 },
  { depth: 200, height: 501, shape: 1, width: 440 },
  { depth: 2898, height: 1302, shape: 4, width: 2898 },
  { depth: 50, height: 50, shape: 1, width: 50 },
  { depth: 248, height: 121, shape: 1, width: 216 },
] as const
