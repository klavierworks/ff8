import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DoubleSide,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Texture,
  Vector3,
  ZeroFactor,
} from 'three'

import {
  FLAT_VERTEX_TINT,
  HALF_BLEND_OPACITY,
  NEUTRAL_VERTEX_TINT,
  QUAD_INDICES,
  QUAD_VERTEX_COUNT,
} from '../constants'

export type PsxBlendMode = 'additive' | 'half' | 'opaque'

export type PsxVertex = {
  textureU: number
  textureV: number
  tint: number
  x: number
  y: number
}

export type ScreenRect = {
  bottom: number
  left: number
  right: number
  top: number
}

const vertexShader = /* glsl */ `
  attribute vec2 texel;
  attribute float tint;
  varying vec2 vTexel;
  varying float vTint;

  void main() {
    vTexel = texel;
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform bool hasMap;
  uniform vec3 modulation;
  uniform float opacity;
  varying vec2 vTexel;
  varying float vTint;

  void main() {
    vec3 tint = vTint * modulation;
    if (!hasMap) {
      gl_FragColor = vec4(tint / 255.0, opacity);
      return;
    }
    ivec2 coordinate = ivec2(mod(floor(vTexel), vec2(textureSize(map, 0))));
    vec4 texel = texelFetch(map, coordinate, 0);
    if (texel.a == 0.0) {
      discard;
    }
    gl_FragColor = vec4(min(texel.rgb * tint / ${NEUTRAL_VERTEX_TINT.toFixed(1)}, 1.0), opacity);
  }
`

const BLEND_SETTINGS = {
  additive: { blendDst: OneFactor, blending: CustomBlending, blendSrc: OneFactor, opacity: 1 },
  half: {
    blendDst: OneMinusSrcAlphaFactor,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    opacity: HALF_BLEND_OPACITY,
  },
  opaque: { blendDst: ZeroFactor, blending: NoBlending, blendSrc: OneFactor, opacity: 1 },
} as const

export const createPsxMaterial = (blendMode: PsxBlendMode, map?: Texture) => {
  const { opacity, ...blend } = BLEND_SETTINGS[blendMode]
  return new ShaderMaterial({
    ...blend,
    blendDstAlpha: OneFactor,
    blendSrcAlpha: ZeroFactor,
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    side: DoubleSide,
    transparent: true,
    uniforms: {
      hasMap: { value: map !== undefined },
      map: { value: map ?? null },
      modulation: { value: new Vector3(1, 1, 1) },
      opacity: { value: opacity },
    },
    vertexShader,
  })
}

export const createPsxGeometry = (vertices: readonly PsxVertex[], indices: readonly number[]) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices.flatMap(({ x, y }) => [x, y, 0])), 3))
  geometry.setAttribute('texel', new BufferAttribute(createTexelArray(vertices), 2))
  geometry.setAttribute('tint', new BufferAttribute(new Float32Array(vertices.map(({ tint }) => tint)), 1))
  geometry.setIndex([...indices])
  return geometry
}

export const createTexelArray = (vertices: readonly Pick<PsxVertex, 'textureU' | 'textureV'>[]) =>
  new Float32Array(vertices.flatMap(({ textureU, textureV }) => [textureU, textureV]))

const getQuadVertices = (screen: ScreenRect, texture: ScreenRect, tint: number): PsxVertex[] => [
  { textureU: texture.left, textureV: texture.top, tint, x: screen.left, y: screen.top },
  { textureU: texture.right, textureV: texture.top, tint, x: screen.right, y: screen.top },
  { textureU: texture.left, textureV: texture.bottom, tint, x: screen.left, y: screen.bottom },
  { textureU: texture.right, textureV: texture.bottom, tint, x: screen.right, y: screen.bottom },
]

export const createPsxQuadGeometry = (screen: ScreenRect, texture: ScreenRect, tint = NEUTRAL_VERTEX_TINT) =>
  createPsxGeometry(getQuadVertices(screen, texture, tint), QUAD_INDICES)

const FLAT_TEXELS: ScreenRect = { bottom: 0, left: 0, right: 0, top: 0 }

export const createFlatRectsGeometry = (rects: readonly ScreenRect[]) =>
  createPsxGeometry(
    rects.flatMap((rect) => getQuadVertices(rect, FLAT_TEXELS, FLAT_VERTEX_TINT)),
    rects.flatMap((_, rectIndex) => QUAD_INDICES.map((index) => index + rectIndex * QUAD_VERTEX_COUNT)),
  )

export const createRect = (left: number, top: number, width: number, height: number): ScreenRect => ({
  bottom: top + height,
  left,
  right: left + width,
  top,
})
