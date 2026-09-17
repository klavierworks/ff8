import { buildWorldPosition } from '../../../worldPosition'
import {
  PLANET_CENTER_X,
  PLANET_CENTER_Y,
  PLANET_QUADS,
  PLANET_TEXEL_STEP,
  PLANET_TRIANGLES,
  PLANET_VERTICES,
  PSX_UNITS_PER_MAP_TEXEL,
  WORLD_MAP_TEXTURE_HEIGHT,
  WORLD_MAP_TEXTURE_WIDTH,
} from '../../constants'
import { createPsxGeometry, createTexelArray, PsxVertex } from '../psxPrimitives'

export type PlanetTextureOrigin = {
  textureU: number
  textureV: number
}

type PlanetPrimitive = {
  isTriangle: boolean
  vertexIndices: readonly number[]
}

type Texel = Pick<PsxVertex, 'textureU' | 'textureV'>

const PLANET_PRIMITIVES: readonly PlanetPrimitive[] = [
  ...PLANET_QUADS.map(([topLeft, topRight, bottomLeft, bottomRight]) => ({
    isTriangle: false,
    vertexIndices: [topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft],
  })),
  ...PLANET_TRIANGLES.map((vertexIndices) => ({ isTriangle: true, vertexIndices })),
]

const PLANET_VERTEX_ORDER = PLANET_PRIMITIVES.flatMap(({ vertexIndices }) => vertexIndices)

export const calculatePlanetTextureOrigin = (worldX: number, worldZ: number): PlanetTextureOrigin => {
  const { psxX, psxY } = buildWorldPosition(worldX, worldZ)
  return {
    textureU: Math.floor(psxX / PSX_UNITS_PER_MAP_TEXEL),
    textureV: Math.floor(psxY / PSX_UNITS_PER_MAP_TEXEL),
  }
}

const getVertexTexel = (origin: PlanetTextureOrigin, vertexIndex: number): Texel => ({
  textureU: origin.textureU + PLANET_TEXEL_STEP * PLANET_VERTICES[vertexIndex].textureU,
  textureV: origin.textureV + PLANET_TEXEL_STEP * PLANET_VERTICES[vertexIndex].textureV,
})

const getWrapCount = (value: number, size: number) => Math.floor(value / size)

const isCrossingTextureEdge = (texels: readonly Texel[]) =>
  new Set(texels.map(({ textureU }) => getWrapCount(textureU, WORLD_MAP_TEXTURE_WIDTH))).size > 1 ||
  new Set(texels.map(({ textureV }) => getWrapCount(textureV, WORLD_MAP_TEXTURE_HEIGHT))).size > 1

const COLLAPSED_TEXEL: Texel = { textureU: 0, textureV: 0 }

const getPrimitiveTexels = (origin: PlanetTextureOrigin, { isTriangle, vertexIndices }: PlanetPrimitive) => {
  const texels = vertexIndices.map((vertexIndex) => getVertexTexel(origin, vertexIndex))
  const isCollapsedEdgeTriangle = isTriangle && isCrossingTextureEdge(texels)
  return isCollapsedEdgeTriangle ? texels.map(() => COLLAPSED_TEXEL) : texels
}

export const calculatePlanetTexels = (origin: PlanetTextureOrigin) =>
  createTexelArray(PLANET_PRIMITIVES.flatMap((primitive) => getPrimitiveTexels(origin, primitive)))

export const createPlanetGeometry = () =>
  createPsxGeometry(
    PLANET_VERTEX_ORDER.map((vertexIndex) => {
      const { shade, x, y } = PLANET_VERTICES[vertexIndex]
      return { textureU: 0, textureV: 0, tint: shade, x: PLANET_CENTER_X + x, y: PLANET_CENTER_Y + y }
    }),
    PLANET_VERTEX_ORDER.map((_, index) => index),
  )

export const isSameTextureOrigin = (first: PlanetTextureOrigin, second: PlanetTextureOrigin) =>
  first.textureU === second.textureU && first.textureV === second.textureV
