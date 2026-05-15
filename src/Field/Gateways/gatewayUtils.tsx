import { Box3, Object3D } from 'three'

const box1 = new Box3()
const box2 = new Box3()

export const checkForIntersectingMeshes = (mesh1: Object3D, mesh2: Object3D) => {
  box1.setFromObject(mesh1, true)
  box2.setFromObject(mesh2, true)

  if (!box1.intersectsBox(box2)) {
    return false
  }

  return true
}
