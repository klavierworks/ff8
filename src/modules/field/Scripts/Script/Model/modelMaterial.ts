import { Material } from 'three'

import { PaletteOffsetUniform, patchPaletteOffset } from './modelPalette'

export const applyModelMaterial = (material: Material, paletteOffset: PaletteOffsetUniform) => {
  material.onBeforeCompile = (shader) => {
    patchPaletteOffset(shader, paletteOffset)
  }
  material.customProgramCacheKey = () => 'fieldModel'
}
