import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { Camera, Color, MathUtils, Vector3 } from 'three'

import { SCREEN_HEIGHT } from '../../../constants/constants'
import {
  WORLDMAP_HORIZON_CURVATURE_MULTIPLIER,
  WORLDMAP_HORIZON_DEPTH_DIVISOR,
} from '../../../constants/worldmapCamera'
import { WORLDMAP_SCALE } from '../constants'
import { radiansToPsx } from '../Player/playerAngles'
import useWorldmapStore, { WorldmapCameraState } from '../worldmapStore'

export type SkyColors = {
  horizon: Color
  lightColor1: Color
  lightColor2: Color
  mid: Color
  zenith: Color
}

export type SkyZone = WorldmapSections['section_32_sky_color_zones']['zones'][number]

type RgbTuple = [number, number, number]

type SkyZoneColor = SkyZone['fog_color_1']

type SkyZoneMatch = {
  blend: number
  index: number
}

export const STARS_ZONE_INDEX = 3

export const SCREEN_QUAD_VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const DEFAULT_ZONE_MATCH: SkyZoneMatch = { blend: 0, index: 0 }
const DISTANCE_SHIFT = 5
const WORLD_STATE_ALTERNATE_ZONES = 4
const CLOUD_QUAD_WIDTH = 256

const _horizonProbe = new Vector3()
const _blendTarget = new Color()

const scaleDownPsxDistance = (value: number) => value >> DISTANCE_SHIFT

const getStartZoneIndex = (worldStateVariable: number) => (worldStateVariable === WORLD_STATE_ALTERNATE_ZONES ? 1 : 2)

const getZoneBlend = (zone: SkyZone, playerX: number, playerY: number) => {
  const distance = Math.hypot(scaleDownPsxDistance(zone.x - playerX), scaleDownPsxDistance(zone.y - playerY))
  const radius = scaleDownPsxDistance(zone.transition_range)
  return radius > distance ? distance / radius : null
}

export const findSkyZoneMatch = (
  zones: readonly SkyZone[],
  playerX: number,
  playerY: number,
  worldStateVariable: number,
): SkyZoneMatch => {
  const start = getStartZoneIndex(worldStateVariable)
  const matched = zones
    .slice(start)
    .map((zone, offset) => ({ blend: getZoneBlend(zone, playerX, playerY), index: start + offset }))
    .find((candidate): candidate is SkyZoneMatch => candidate.blend !== null)
  return matched ?? DEFAULT_ZONE_MATCH
}

const setColorFromZone = (_color: Color, source: SkyZoneColor) => _color.fromArray(source).multiplyScalar(1 / 255)

const blendZoneColor = (_output: Color, matched: SkyZoneColor, fallback: SkyZoneColor, t: number) =>
  setColorFromZone(_output, matched).lerp(setColorFromZone(_blendTarget, fallback), t)

export const updateSkyColors = (_output: SkyColors, zones: readonly SkyZone[], match: SkyZoneMatch) => {
  const defaultZone = zones[0]
  const matched = zones[match.index] ?? defaultZone
  const t = MathUtils.clamp(match.blend, 0, 1)
  blendZoneColor(_output.zenith, matched.fog_color_1, defaultZone.fog_color_1, t)
  blendZoneColor(_output.mid, matched.fog_color_2, defaultZone.fog_color_2, t)
  blendZoneColor(_output.horizon, matched.fog_color_3, defaultZone.fog_color_3, t)
  blendZoneColor(_output.lightColor1, matched.light_color_1, defaultZone.light_color_1, t)
  blendZoneColor(_output.lightColor2, matched.light_color_2, defaultZone.light_color_2, t)
}

export const createSkyColors = (): SkyColors => ({
  horizon: new Color(),
  lightColor1: new Color(),
  lightColor2: new Color(),
  mid: new Color(),
  zenith: new Color(),
})

const convertColorToRgbTuple = (color: Color): RgbTuple => [
  Math.round(color.r * 255),
  Math.round(color.g * 255),
  Math.round(color.b * 255),
]

const areRgbTuplesEqual = (a: RgbTuple, b: RgbTuple) => a.every((channel, index) => channel === b[index])

export const publishSkyLightColors = ({ lightColor1, lightColor2 }: SkyColors) => {
  const { skyLightColor1, skyLightColor2 } = useWorldmapStore.getState()
  const nextLight1 = convertColorToRgbTuple(lightColor1)
  const nextLight2 = convertColorToRgbTuple(lightColor2)
  if (areRgbTuplesEqual(nextLight1, skyLightColor1) && areRgbTuplesEqual(nextLight2, skyLightColor2)) {
    return
  }
  useWorldmapStore.setState({ skyLightColor1: nextLight1, skyLightColor2: nextLight2 })
}

const calculateHorizonProbeDistance = ({ curvatureStart, depth }: WorldmapCameraState) =>
  (depth + WORLDMAP_HORIZON_CURVATURE_MULTIPLIER * curvatureStart) * WORLDMAP_SCALE

const calculateHorizonDepthShift = ({ depth }: WorldmapCameraState) =>
  Math.trunc(Math.abs(depth) / WORLDMAP_HORIZON_DEPTH_DIVISOR)

export const calculateHorizonScreenY = (camera: Camera, player: Vector3, cameraState: WorldmapCameraState) => {
  const distance = calculateHorizonProbeDistance(cameraState)
  _horizonProbe
    .set(
      player.x - Math.sin(cameraState.yawRadians) * distance,
      0,
      player.z - Math.cos(cameraState.yawRadians) * distance,
    )
    .project(camera)
  return ((1 - _horizonProbe.y) / 2) * SCREEN_HEIGHT + calculateHorizonDepthShift(cameraState)
}

export const calculateCloudStartX = (yawRadians: number) => {
  const scroll = Math.round(radiansToPsx(-yawRadians)) % CLOUD_QUAD_WIDTH
  return scroll === 0 ? -CLOUD_QUAD_WIDTH : -scroll
}
