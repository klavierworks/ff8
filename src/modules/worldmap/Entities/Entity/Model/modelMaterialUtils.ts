import { Color, DoubleSide, Mesh, MeshBasicMaterial, Object3D, SRGBColorSpace, Texture } from 'three'

import { WMSET_MODEL_ALPHA_TEST, WMSET_MODEL_TINT_NEUTRAL } from '../../../../../constants/worldmapEntities'

type RgbBytes = readonly [number, number, number]

export const prepareAtlasTexture = (texture: Texture) => {
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
}

const createModelMaterial = (texture: Texture) =>
  new MeshBasicMaterial({ alphaTest: WMSET_MODEL_ALPHA_TEST, map: texture, side: DoubleSide })

const getModelMeshes = (root: Object3D) => {
  const meshes: Mesh[] = []
  root.traverse((child) => {
    if (child instanceof Mesh) {
      meshes.push(child)
    }
  })
  return meshes
}

export const cloneWithModelMaterial = (source: Object3D, texture: Texture) => {
  const clone = source.clone(true)
  const material = createModelMaterial(texture)
  getModelMeshes(clone).forEach((mesh) => {
    mesh.material = material
  })
  return { clone, material }
}

export const applyModelTint = (material: MeshBasicMaterial, tint: RgbBytes) => {
  const color = new Color().setRGB(
    tint[0] / WMSET_MODEL_TINT_NEUTRAL,
    tint[1] / WMSET_MODEL_TINT_NEUTRAL,
    tint[2] / WMSET_MODEL_TINT_NEUTRAL,
    SRGBColorSpace,
  )
  material.color.copy(color)
}
