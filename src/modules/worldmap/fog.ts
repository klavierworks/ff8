import { WebGLProgramParametersWithUniforms } from 'three'

import {
  WORLDMAP_FOG_DEPTH_DIVISOR,
  WORLDMAP_FOG_LEVEL_DIVISOR,
  WORLDMAP_FOG_LEVEL_MAX,
  WORLDMAP_FOG_START_DEFAULT,
} from '../../constants/worldmapCamera'
import { WORLDMAP_SCALE } from './constants'

export const FOG_UNIFORMS = {
  uFogStart: { value: WORLDMAP_FOG_START_DEFAULT },
}

const FOG_VERTEX_DECLARATIONS = /* glsl */ `
varying float vFogDepthPsx;
`

const FOG_VERTEX_DEPTH = /* glsl */ `
vFogDepthPsx = -mvPosition.z * ${(1 / WORLDMAP_SCALE).toFixed(1)};
`

const FOG_FRAGMENT_DECLARATIONS = /* glsl */ `
uniform float uFogStart;
varying float vFogDepthPsx;
`

const FOG_FRAGMENT_OVERLAY = /* glsl */ `
float fogLevel = floor((floor(vFogDepthPsx / ${WORLDMAP_FOG_DEPTH_DIVISOR.toFixed(1)}) - uFogStart) / ${WORLDMAP_FOG_LEVEL_DIVISOR.toFixed(1)});
gl_FragColor.rgb += clamp(fogLevel, 0.0, ${WORLDMAP_FOG_LEVEL_MAX.toFixed(1)}) / ${WORLDMAP_FOG_LEVEL_MAX.toFixed(1)};
`

const FOG_VERTEX_ANCHOR = '#include <fog_vertex>'
const FOG_FRAGMENT_ANCHOR = '#include <colorspace_fragment>'

export const injectDistanceFog = (shader: WebGLProgramParametersWithUniforms) => {
  Object.assign(shader.uniforms, FOG_UNIFORMS)
  shader.vertexShader =
    FOG_VERTEX_DECLARATIONS +
    shader.vertexShader.replace(FOG_VERTEX_ANCHOR, `${FOG_VERTEX_ANCHOR}\n${FOG_VERTEX_DEPTH}`)
  shader.fragmentShader =
    FOG_FRAGMENT_DECLARATIONS +
    shader.fragmentShader.replace(FOG_FRAGMENT_ANCHOR, `${FOG_FRAGMENT_ANCHOR}\n${FOG_FRAGMENT_OVERLAY}`)
}

export const updateFogUniforms = (fogStart: number) => {
  FOG_UNIFORMS.uFogStart.value = fogStart
}
