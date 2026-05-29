export const VARIANT_STAGING_ROW = 24

type SegmentVariantEntry = {
  region: number
  segmentIndex: number
  variantIndex: number
}

const ACTIVE_REGIONS_BY_STATE: Record<number, number[]> = {
  0: [0, 2, 3, 4],
  1: [0, 2, 3],
  2: [0],
  3: [],
  4: [],
}

const SEGMENT_VARIANT_MAP: SegmentVariantEntry[] = [
  { region: 0, segmentIndex: 373, variantIndex: 0 },
  { region: 0, segmentIndex: 374, variantIndex: 1 },
  { region: 0, segmentIndex: 375, variantIndex: 2 },
  { region: 0, segmentIndex: 376, variantIndex: 3 },
  { region: 0, segmentIndex: 377, variantIndex: 4 },
  { region: 0, segmentIndex: 378, variantIndex: 5 },
  { region: 0, segmentIndex: 379, variantIndex: 6 },
  { region: 0, segmentIndex: 380, variantIndex: 7 },
  { region: 0, segmentIndex: 405, variantIndex: 8 },
  { region: 0, segmentIndex: 406, variantIndex: 9 },
  { region: 0, segmentIndex: 407, variantIndex: 10 },
  { region: 0, segmentIndex: 408, variantIndex: 11 },
  { region: 0, segmentIndex: 409, variantIndex: 12 },
  { region: 0, segmentIndex: 410, variantIndex: 13 },
  { region: 0, segmentIndex: 411, variantIndex: 14 },
  { region: 0, segmentIndex: 412, variantIndex: 15 },
  { region: 0, segmentIndex: 437, variantIndex: 16 },
  { region: 0, segmentIndex: 438, variantIndex: 17 },
  { region: 0, segmentIndex: 439, variantIndex: 18 },
  { region: 0, segmentIndex: 440, variantIndex: 19 },
  { region: 0, segmentIndex: 441, variantIndex: 20 },
  { region: 0, segmentIndex: 442, variantIndex: 21 },
  { region: 0, segmentIndex: 443, variantIndex: 22 },
  { region: 0, segmentIndex: 444, variantIndex: 23 },
  { region: 0, segmentIndex: 469, variantIndex: 24 },
  { region: 0, segmentIndex: 470, variantIndex: 25 },
  { region: 0, segmentIndex: 471, variantIndex: 26 },
  { region: 0, segmentIndex: 472, variantIndex: 27 },
  { region: 0, segmentIndex: 473, variantIndex: 28 },
  { region: 0, segmentIndex: 474, variantIndex: 29 },
  { region: 0, segmentIndex: 475, variantIndex: 30 },
  { region: 0, segmentIndex: 476, variantIndex: 31 },
  { region: 0, segmentIndex: 501, variantIndex: 32 },
  { region: 0, segmentIndex: 502, variantIndex: 33 },
  { region: 0, segmentIndex: 503, variantIndex: 34 },
  { region: 0, segmentIndex: 504, variantIndex: 35 },
  { region: 0, segmentIndex: 505, variantIndex: 36 },
  { region: 0, segmentIndex: 506, variantIndex: 37 },
  { region: 0, segmentIndex: 507, variantIndex: 38 },
  { region: 0, segmentIndex: 508, variantIndex: 39 },
  { region: 0, segmentIndex: 533, variantIndex: 40 },
  { region: 0, segmentIndex: 534, variantIndex: 41 },
  { region: 0, segmentIndex: 535, variantIndex: 42 },
  { region: 0, segmentIndex: 536, variantIndex: 43 },
  { region: 0, segmentIndex: 537, variantIndex: 44 },
  { region: 0, segmentIndex: 538, variantIndex: 45 },
  { region: 0, segmentIndex: 539, variantIndex: 46 },
  { region: 0, segmentIndex: 540, variantIndex: 47 },
  { region: 0, segmentIndex: 565, variantIndex: 48 },
  { region: 0, segmentIndex: 566, variantIndex: 49 },
  { region: 0, segmentIndex: 567, variantIndex: 50 },
  { region: 0, segmentIndex: 568, variantIndex: 51 },
  { region: 0, segmentIndex: 569, variantIndex: 52 },
  { region: 0, segmentIndex: 570, variantIndex: 53 },
  { region: 0, segmentIndex: 571, variantIndex: 54 },
  { region: 0, segmentIndex: 572, variantIndex: 55 },
  { region: 1, segmentIndex: 149, variantIndex: 56 },
  { region: 1, segmentIndex: 150, variantIndex: 57 },
  { region: 2, segmentIndex: 267, variantIndex: 58 },
  { region: 3, segmentIndex: 274, variantIndex: 59 },
  { region: 3, segmentIndex: 275, variantIndex: 60 },
  { region: 4, segmentIndex: 327, variantIndex: 61 },
  { region: 5, segmentIndex: 214, variantIndex: 62 },
  { region: 5, segmentIndex: 215, variantIndex: 63 },
  { region: 5, segmentIndex: 246, variantIndex: 64 },
  { region: 5, segmentIndex: 247, variantIndex: 65 },
  { region: 6, segmentIndex: 361, variantIndex: 66 },
]

export const getTilesState = (worldStateVariable: number, isDDistrictPrisonAboveGround: boolean) => {
  const activeRegions = [
    ...(ACTIVE_REGIONS_BY_STATE[worldStateVariable] ?? []),
    ...(isDDistrictPrisonAboveGround ? [6] : []),
  ]
  return SEGMENT_VARIANT_MAP.filter((entry) => activeRegions.includes(entry.region)).map(
    ({ segmentIndex, variantIndex }) => ({
      segmentIndex,
      variantIndex,
    }),
  )
}
