import { AdditiveBlending, NoBlending, NormalBlending, SubtractiveBlending } from 'three'

// ─── PSX semi-transparency modes ───
// 0: half back + half front, 1: back + front, 2: back - front, 3: back + quarter front.
// 4 is not a hardware mode: it is how the field data spells "draw this opaque".
export const PSX_BLEND_MODES = {
  0: NormalBlending,
  1: AdditiveBlending,
  2: SubtractiveBlending,
  3: AdditiveBlending,
  4: NoBlending,
} as const

export const PSX_BLEND_HALF = 0
export const PSX_BLEND_QUARTER_ADD = 3

export const PSX_HALF_OPACITY = 0.5
export const PSX_QUARTER_INTENSITY = 0.25
