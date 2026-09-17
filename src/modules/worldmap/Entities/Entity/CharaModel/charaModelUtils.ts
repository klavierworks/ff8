import { DoubleSide, Mesh, Object3D } from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'

const setMeshDoubleSided = (mesh: Mesh) => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => {
    material.side = DoubleSide
  })
}

export const cloneDoubleSidedScene = (scene: Object3D) => {
  const clone = cloneSkinnedScene(scene)
  clone.traverse((child) => {
    if (child instanceof Mesh) {
      setMeshDoubleSided(child)
    }
  })
  return clone
}
