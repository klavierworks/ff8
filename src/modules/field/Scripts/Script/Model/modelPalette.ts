import { Vector3, WebGLProgramParametersWithUniforms } from 'three'

export type PaletteOffsetUniform = { value: Vector3 }

const PALETTE_NEUTRAL = 128
const PALETTE_STEP = 8
const PALETTE_LEVELS = 31

export const getPaletteOffset = (modelColors: ModelColor[] | undefined, modelName: string) => {
  const entry = modelColors?.find((color) => color.name === modelName) ?? modelColors?.[0]
  if (!entry) {
    return new Vector3()
  }

  const [red, green, blue] = entry.color.map((channel) => Math.trunc((channel - PALETTE_NEUTRAL) / PALETTE_STEP))
  return new Vector3(red, green, blue)
}

export const createPaletteOffsetUniform = (): PaletteOffsetUniform => ({ value: new Vector3() })

const FRAGMENT_DECLARATION = `uniform vec3 paletteOffset;

vec3 encodePalette( vec3 value ) {
  return mix( value * 12.92, pow( value, vec3( 0.41666 ) ) * 1.055 - 0.055, step( 0.0031308, value ) );
}

vec3 decodePalette( vec3 value ) {
  return mix( value * 0.0773993808, pow( value * 0.9478672986 + 0.0521327014, vec3( 2.4 ) ), step( 0.04045, value ) );
}

#include <common>`

const FRAGMENT_OVERRIDE = `#ifdef USE_MAP
  vec4 paletteColor = texture2D( map, vMapUv );
  vec3 paletteIndex = floor( encodePalette( paletteColor.rgb ) * ${PALETTE_LEVELS}.0 + 0.5 );
  paletteColor.rgb = decodePalette( clamp( paletteIndex + paletteOffset, 1.0, ${PALETTE_LEVELS}.0 ) / ${PALETTE_LEVELS}.0 );
  diffuseColor *= paletteColor;
#endif`

export const patchPaletteOffset = (shader: WebGLProgramParametersWithUniforms, paletteOffset: PaletteOffsetUniform) => {
  shader.uniforms.paletteOffset = paletteOffset
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', FRAGMENT_DECLARATION)
    .replace('#include <map_fragment>', FRAGMENT_OVERRIDE)
}
