import { BufferAttribute, BufferGeometry } from 'three'

import {
  SPARKLE_COLOR_RAMPS,
  SPARKLE_COUNT,
  SPARKLE_HEAD_COLOR,
  SPARKLE_SAMPLE_COUNT,
} from '../../../../../../constants/drawPoints'
import { getSparkleTrail, Sparkle, SparkleSample } from './sparkleSimulation'

const EDGES_PER_SAMPLE = 2
const VERTICES_PER_SPARKLE = SPARKLE_SAMPLE_COUNT * EDGES_PER_SAMPLE
const COLOR_SCALE = 1 / 255

export type SparkleColorRamp = (typeof SPARKLE_COLOR_RAMPS)[number]

export type SparkleRibbons = {
  colors: BufferAttribute
  geometry: BufferGeometry
  positions: BufferAttribute
}

const buildRibbonIndices = () =>
  Array.from({ length: SPARKLE_COUNT }, (_, slot) =>
    Array.from({ length: SPARKLE_SAMPLE_COUNT - 1 }, (_, segment) => {
      const base = slot * VERTICES_PER_SPARKLE + segment * EDGES_PER_SAMPLE

      return [base, base + 1, base + 3, base, base + 3, base + 2]
    }).flat(),
  ).flat()

export const createSparkleRibbons = (): SparkleRibbons => {
  const vertexCount = SPARKLE_COUNT * VERTICES_PER_SPARKLE
  const positions = new BufferAttribute(new Float32Array(vertexCount * 3), 3)
  const colors = new BufferAttribute(new Float32Array(vertexCount * 3), 3)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', positions)
  geometry.setAttribute('color', colors)
  geometry.setIndex(buildRibbonIndices())

  return { colors, geometry, positions }
}

export const disposeSparkleRibbons = (ribbons: SparkleRibbons) => {
  ribbons.geometry.dispose()
}

const writeSampleEdges = (ribbons: SparkleRibbons, vertex: number, { center, offset }: SparkleSample) => {
  ribbons.positions.setXYZ(vertex, center.x - offset.x, center.y - offset.y, center.z - offset.z)
  ribbons.positions.setXYZ(vertex + 1, center.x + offset.x, center.y + offset.y, center.z + offset.z)
}

const writeSampleColor = (ribbons: SparkleRibbons, vertex: number, [red, green, blue]: SparkleColorRamp[number]) => {
  ribbons.colors.setXYZ(vertex, red * COLOR_SCALE, green * COLOR_SCALE, blue * COLOR_SCALE)
  ribbons.colors.setXYZ(vertex + 1, red * COLOR_SCALE, green * COLOR_SCALE, blue * COLOR_SCALE)
}

const writeSparkle = (ribbons: SparkleRibbons, sparkle: Sparkle, slot: number, ramp: SparkleColorRamp) => {
  const base = slot * VERTICES_PER_SPARKLE

  getSparkleTrail(sparkle).forEach((sample, age) => {
    const vertex = base + age * EDGES_PER_SAMPLE
    writeSampleEdges(ribbons, vertex, sample)
    writeSampleColor(ribbons, vertex, age === 0 ? SPARKLE_HEAD_COLOR : ramp[age - 1])
  })
}

export const writeSparkleRibbons = (ribbons: SparkleRibbons, sparkles: readonly Sparkle[], ramp: SparkleColorRamp) => {
  sparkles.forEach((sparkle, slot) => writeSparkle(ribbons, sparkle, slot, ramp))

  ribbons.positions.needsUpdate = true
  ribbons.colors.needsUpdate = true
}
