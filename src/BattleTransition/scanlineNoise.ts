import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/constants'

const ENDPOINT_RANGE = 120
const ROUGHNESS_DIVISOR = 30
const RAGGED_EDGE_SCALE = 2
const CHANNELS_PER_TEXEL = 4

const randomBelow = (limit: number) => Math.floor(Math.random() * limit)

const displaceMidpoints = (rows: readonly number[], start: number, end: number): number[] => {
  const middle = (start + end) >> 1
  if (middle <= start || middle >= end) {
    return [...rows]
  }

  const roughness = Math.floor(SCREEN_HEIGHT / ROUGHNESS_DIVISOR) + ((end - start) >> 2)
  const displaced = rows.map((value, row) =>
    row === middle ? ((rows[start] + rows[end]) >> 1) + randomBelow(roughness + 1) : value,
  )

  return displaceMidpoints(displaceMidpoints(displaced, start, middle), middle, end)
}

export const createScanlineOffsets = () => {
  const lastRow = SCREEN_HEIGHT - 1
  const seeded = Array.from({ length: SCREEN_HEIGHT }, (_value, row) =>
    row === 0 || row === lastRow ? randomBelow(ENDPOINT_RANGE) : 0,
  )
  const rows = displaceMidpoints(seeded, 0, lastRow)

  return Float32Array.from({ length: SCREEN_HEIGHT * CHANNELS_PER_TEXEL }, (_value, index) =>
    index % CHANNELS_PER_TEXEL === 0 ? (rows[index / CHANNELS_PER_TEXEL] * RAGGED_EDGE_SCALE) / SCREEN_WIDTH : 0,
  )
}
