import { Material } from 'three'

import { ModelDepthUniform, patchModelDepth } from './modelDepth'
import { PaletteOffsetUniform, patchPaletteOffset } from './modelPalette'

export const applyModelMaterial = (
  material: Material,
  modelViewDepth: ModelDepthUniform,
  paletteOffset: PaletteOffsetUniform,
) => {
  material.onBeforeCompile = (shader) => {
    patchModelDepth(shader, modelViewDepth)
    patchPaletteOffset(shader, paletteOffset)
  }
  material.customProgramCacheKey = () => 'fieldModel'
}
