import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { Color } from 'three'

export type RgbTuple = [number, number, number]

export type SkyZone = WorldmapSections['section_32_sky_color_zones']['zones'][number]

type ResolvedSkyColors = {
  horizon: Color
  lightColor1: Color
  lightColor2: Color
  mid: Color
  zenith: Color
}

type SkyZoneColor = SkyZone['fog_color_1']

type SkyZoneMatch = {
  blend: number
  index: number
}

export const STARS_ZONE_INDEX = 3

const DISTANCE_SHIFT = 5
const VEHICLE_CLASS_MASK = 0x1f
const FOOT_VEHICLE_CLASS = 4

const getVehicleClass = (vehicleFlag: number) => vehicleFlag & VEHICLE_CLASS_MASK

const scaleDownPsxDistance = (value: number) => value >> DISTANCE_SHIFT

const lerpU8 = (a: number, b: number, t: number) => (a + t * (b - a)) / 255

const lerpColor = (a: SkyZoneColor, b: SkyZoneColor, t: number, output: Color) => {
  output.setRGB(lerpU8(a[0], b[0], t), lerpU8(a[1], b[1], t), lerpU8(a[2], b[2], t))
  return output
}

const writeColor = (source: SkyZoneColor, output: Color) => {
  output.setRGB(source[0] / 255, source[1] / 255, source[2] / 255)
  return output
}

const getStartZoneIndex = (vehicleFlag: number) => (getVehicleClass(vehicleFlag) !== FOOT_VEHICLE_CLASS ? 2 : 1)

const getZoneBlend = (zone: SkyZone | undefined, playerX: number, playerY: number): null | number => {
  if (!zone) {
    return null
  }
  const dx = scaleDownPsxDistance(zone.x - playerX)
  const dy = scaleDownPsxDistance(zone.y - playerY)
  const distance = Math.sqrt(dx * dx + dy * dy)
  const radius = scaleDownPsxDistance(zone.transition_range)
  if (radius > distance) {
    return Math.min(distance / radius, 1)
  }
  return null
}

export const matchZone = (
  zones: readonly SkyZone[],
  playerX: number,
  playerY: number,
  vehicleFlag: number,
): SkyZoneMatch => {
  const start = getStartZoneIndex(vehicleFlag)
  const matched = zones
    .map((zone, index) => ({ blend: getZoneBlend(zone, playerX, playerY), index }))
    .slice(start)
    .find((candidate) => candidate.blend !== null)
  if (!matched || matched.blend === null) {
    return { blend: 0, index: 0 }
  }
  return { blend: matched.blend, index: matched.index }
}

export const resolveSkyColors = (
  zones: readonly SkyZone[],
  match: SkyZoneMatch,
  output: ResolvedSkyColors,
): null | ResolvedSkyColors => {
  const defaultZone = zones[0]
  if (!defaultZone) {
    return null
  }
  const matched = zones[match.index] ?? defaultZone
  if (match.index === 0) {
    writeColor(defaultZone.fog_color_1, output.zenith)
    writeColor(defaultZone.fog_color_2, output.mid)
    writeColor(defaultZone.fog_color_3, output.horizon)
    writeColor(defaultZone.light_color_1, output.lightColor1)
    writeColor(defaultZone.light_color_2, output.lightColor2)
    return output
  }
  const t = Math.min(Math.max(match.blend, 0), 1)
  lerpColor(matched.fog_color_1, defaultZone.fog_color_1, t, output.zenith)
  lerpColor(matched.fog_color_2, defaultZone.fog_color_2, t, output.mid)
  lerpColor(matched.fog_color_3, defaultZone.fog_color_3, t, output.horizon)
  lerpColor(matched.light_color_1, defaultZone.light_color_1, t, output.lightColor1)
  lerpColor(matched.light_color_2, defaultZone.light_color_2, t, output.lightColor2)
  return output
}

export const createResolvedSkyColors = (): ResolvedSkyColors => ({
  horizon: new Color(),
  lightColor1: new Color(),
  lightColor2: new Color(),
  mid: new Color(),
  zenith: new Color(),
})

export const toRgbTuple = (color: Color): RgbTuple => [
  Math.round(color.r * 255),
  Math.round(color.g * 255),
  Math.round(color.b * 255),
]

export const areRgbTuplesEqual = (a: RgbTuple, b: RgbTuple) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
