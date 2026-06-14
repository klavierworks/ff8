import { PSX_ANGLE_UNITS, WORLD_WRAP_X, WORLD_WRAP_Z } from '../constants'
import { positiveModulo } from '../worldPosition'

export const MINIMAP_MODE_HIDDEN = 0
export const MINIMAP_MODE_PLANET = 1
export const MINIMAP_MODE_SMALL = 2
export const MINIMAP_MODE_LARGE = 3

export const MINIMAP_MODES = [MINIMAP_MODE_HIDDEN, MINIMAP_MODE_PLANET, MINIMAP_MODE_SMALL, MINIMAP_MODE_LARGE] as const

const ENGINE_SCREEN_WIDTH_PIXELS = 320
const ENGINE_SCREEN_HEIGHT_PIXELS = 224

const widthPercent = (pixels: number) => (pixels / ENGINE_SCREEN_WIDTH_PIXELS) * 100
const heightPercent = (pixels: number) => (pixels / ENGINE_SCREEN_HEIGHT_PIXELS) * 100

const MINIMAP_PLANET_DIAMETER_PIXELS = 48
export const MINIMAP_PLANET_DIAMETER_PERCENT = widthPercent(MINIMAP_PLANET_DIAMETER_PIXELS)
export const MINIMAP_PLANET_CENTER_LEFT_PERCENT = widthPercent(260)
export const MINIMAP_PLANET_CENTER_TOP_PERCENT = heightPercent(180)

export const MINIMAP_SMALL_LEFT_PERCENT = widthPercent(ENGINE_SCREEN_WIDTH_PIXELS - 134)
export const MINIMAP_SMALL_TOP_PERCENT = heightPercent(ENGINE_SCREEN_HEIGHT_PIXELS - 100)
export const MINIMAP_SMALL_WIDTH_PERCENT = widthPercent(128)
export const MINIMAP_SMALL_HEIGHT_PERCENT = heightPercent(96)

export const MINIMAP_LARGE_LEFT_PERCENT = widthPercent((ENGINE_SCREEN_WIDTH_PIXELS - 256) / 2)
export const MINIMAP_LARGE_TOP_PERCENT = heightPercent((ENGINE_SCREEN_HEIGHT_PIXELS - 192) / 2)
export const MINIMAP_LARGE_WIDTH_PERCENT = widthPercent(256)
export const MINIMAP_LARGE_HEIGHT_PERCENT = heightPercent(192)

export const computeMapNormalisedPosition = (worldX: number, worldZ: number) => ({
  u: positiveModulo(worldX / WORLD_WRAP_X, 1),
  v: positiveModulo(worldZ / WORLD_WRAP_Z, 1),
})

export const psxAngleToCssDegrees = (psxAngle: number) => -(psxAngle / PSX_ANGLE_UNITS) * 360 + 180
