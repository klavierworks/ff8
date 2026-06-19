// ─── Sprite-atlas rects into the exported FF8 card-game sheets (top-left origin) ───

import { CardElement } from './cardGame'

export type AtlasRect = { height: number; width: number; x: number; y: number }

export const ICONS_SHEET_WIDTH = 768
export const ICONS_SHEET_HEIGHT = 192

export const MC_SHEET_WIDTH = 256
export const MC_SHEET_HEIGHT = 192
export const MC_TILE = 64
export const MC_CARDS_PER_SHEET = 11
export const MC_COLUMNS = 4

// Card-back is slot 11 (column 3, row 2) of every mc sheet.
export const CARD_BACK_RECT: AtlasRect = { height: 64, width: 64, x: 192, y: 128 }

// Small digits 0–9 (header row), plus 'A' for power 10. 9×9 glyphs on a 16px pitch.
const SMALL_DIGIT_Y = 1
const SMALL_DIGIT_SIZE = 9
export const SMALL_DIGIT_RECTS: AtlasRect[] = Array.from({ length: 10 }, (_, digit) => ({
  height: SMALL_DIGIT_SIZE,
  width: SMALL_DIGIT_SIZE,
  x: 1 + 16 * digit,
  y: SMALL_DIGIT_Y,
}))
export const SMALL_DIGIT_A_RECT: AtlasRect = { height: 9, width: 9, x: 161, y: SMALL_DIGIT_Y }

// Element icons: 8 elements, 4 animation frames each, 14×14 on a 16px pitch.
const ELEMENT_ICON_SIZE = 14
const ELEMENT_BASE: Record<Exclude<CardElement, 'none'>, { x: number; y: number }> = {
  earth: { x: 193, y: 17 },
  fire: { x: 1, y: 17 },
  holy: { x: 193, y: 33 },
  ice: { x: 65, y: 17 },
  poison: { x: 1, y: 33 },
  thunder: { x: 129, y: 17 },
  water: { x: 129, y: 33 },
  wind: { x: 65, y: 33 },
}

export const ELEMENT_ICON_FRAMES = 4

export const getElementIconRect = (element: Exclude<CardElement, 'none'>, frame = 0): AtlasRect => {
  const base = ELEMENT_BASE[element]
  return {
    height: ELEMENT_ICON_SIZE,
    width: ELEMENT_ICON_SIZE,
    x: base.x + 16 * (frame % ELEMENT_ICON_FRAMES),
    y: base.y,
  }
}

export const BANNER_RECTS = {
  combo: { height: 49, width: 147, x: 566, y: 135 },
  draw: { height: 41, width: 93, x: 338, y: 100 },
  lose: { height: 40, width: 215, x: 276, y: 53 },
  plus: { height: 47, width: 110, x: 585, y: 73 },
  same: { height: 48, width: 122, x: 579, y: 8 },
  win: { height: 40, width: 209, x: 280, y: 4 },
} as const satisfies Record<string, AtlasRect>

export type BannerKey = keyof typeof BANNER_RECTS

// Slot 11 per mc sheet, 4-wide grid, in card-ID order.
export const getCardFaceTile = (definitionId: number) => {
  const sheetIndex = Math.floor(definitionId / MC_CARDS_PER_SHEET)
  const slot = definitionId % MC_CARDS_PER_SHEET
  const column = slot % MC_COLUMNS
  const row = Math.floor(slot / MC_COLUMNS)
  return { rect: { height: MC_TILE, width: MC_TILE, x: column * MC_TILE, y: row * MC_TILE }, sheetIndex }
}

// Big silver score digits (1–9): 24×24 cells on row y=48, pitch 24, glyph n at x=24*(n-1).
export const getScoreDigitRect = (value: number): AtlasRect => {
  const clamped = Math.min(9, Math.max(1, Math.round(value)))
  return { height: 24, width: 24, x: 24 * (clamped - 1), y: 48 }
}

// Power 10 renders as 'A', matching FF8.
export const getPowerRect = (value: number): AtlasRect => {
  if (value >= 10) {
    return SMALL_DIGIT_A_RECT
  }
  return SMALL_DIGIT_RECTS[value] ?? SMALL_DIGIT_RECTS[0]
}
