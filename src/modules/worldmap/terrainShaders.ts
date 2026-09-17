import { Material, WebGLProgramParametersWithUniforms } from 'three'

import { injectCurvature } from './curvature'
import { injectDistanceFog } from './fog'

const TERRAIN_SHADERS_APPLIED_FLAG = 'hasTerrainShaders'
const TERRAIN_PROGRAM_KEY = 'worldmap-terrain-curvature-fog'

const injectTerrainShaders = (shader: WebGLProgramParametersWithUniforms) => {
  injectCurvature(shader)
  injectDistanceFog(shader)
}

export const applyTerrainShaders = (material: Material) => {
  if (material.userData[TERRAIN_SHADERS_APPLIED_FLAG]) {
    return
  }
  material.userData[TERRAIN_SHADERS_APPLIED_FLAG] = true
  material.onBeforeCompile = injectTerrainShaders
  material.customProgramCacheKey = () => TERRAIN_PROGRAM_KEY
  material.needsUpdate = true
}
