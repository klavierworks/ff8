import { Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Texture } from 'three'

import { WALKMESH_USER_DATA_KEY } from '../../constants'

export const SEA_CYCLE_FRAME_COUNT = 6
export const SEA_CYCLE_FRAMES_PER_SECOND = 1
export const SEA_CYCLE_FRAME_WIDTH = 1 / SEA_CYCLE_FRAME_COUNT
const SPRITE_SHEET_REPEAT_EPSILON = 1e-4

const configureTileMaterial = (material: Material) => {
  if (!(material instanceof MeshStandardMaterial) && !(material instanceof MeshBasicMaterial)) {
    return
  }
  if (!material.map) {
    return
  }
  material.alphaTest = 0.5
  material.transparent = false
  material.needsUpdate = true
}

export const configureTileMesh = (object: Object3D) => {
  if (!(object instanceof Mesh)) {
    return
  }
  object.userData[WALKMESH_USER_DATA_KEY] = true
  const materials = Array.isArray(object.material) ? object.material : [object.material]
  materials.forEach(configureTileMaterial)
}

export const collectAnimatedTextures = (root: Object3D) => {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!(material instanceof MeshStandardMaterial) && !(material instanceof MeshBasicMaterial)) {
        return
      }
      const map = material.map
      if (!map) {
        return
      }
      if (Math.abs(map.repeat.x - SEA_CYCLE_FRAME_WIDTH) > SPRITE_SHEET_REPEAT_EPSILON) {
        return
      }
      textures.add(map)
    })
  })
  return Array.from(textures)
}
