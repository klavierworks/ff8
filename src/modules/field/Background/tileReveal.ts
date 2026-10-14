import { Material } from 'three'

import { BACKGROUND_TILE_FADE_WINDOW } from '../../../constants/fieldReveal'
import { ProgressUniform } from '../fieldRevealStore'
import { createRevealDiscard, REVEAL_DITHER_DECLARATION } from '../revealDither'

const compareRevealOrder = (a: Tile, b: Tile) => b.Z - a.Z || a.Y - b.Y || a.X - b.X

export const getTileRevealOrders = (tiles: Tile[]) => {
  const lastIndex = Math.max(1, tiles.length - 1)
  return new Map([...tiles].sort(compareRevealOrder).map((tile, index) => [tile, index / lastIndex] as const))
}

const FADE_WINDOW = BACKGROUND_TILE_FADE_WINDOW.toFixed(4)

const VERTEX_DECLARATION = `attribute float revealOrder;
uniform float tileReveal;
varying float vTileFade;
#include <common>`

const VERTEX_FADE = `#include <begin_vertex>
vTileFade = clamp( ( tileReveal - revealOrder * ( 1.0 - ${FADE_WINDOW} ) ) / ${FADE_WINDOW}, 0.0, 1.0 );`

const FRAGMENT_DECLARATION = `varying float vTileFade;
${REVEAL_DITHER_DECLARATION}
#include <common>`

export const patchTileReveal = (material: Material, tileReveal: ProgressUniform) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tileReveal = tileReveal
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_DECLARATION)
      .replace('#include <begin_vertex>', VERTEX_FADE)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_DECLARATION)
      .replace('#include <clipping_planes_fragment>', createRevealDiscard('vTileFade'))
  }
  material.customProgramCacheKey = () => 'backgroundTileReveal'
  material.needsUpdate = true
}
