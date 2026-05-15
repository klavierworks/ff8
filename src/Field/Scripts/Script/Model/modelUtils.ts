import { Box3, Group, Object3D, Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../store'

export const getScriptEntity = (scene: Scene, scriptGroupId: number) => {
  return scene.getObjectByName(`entity--${scriptGroupId}`) as Group
}

export const getPartyMemberModelComponent = (scene: Scene, partyMemberIndex: number): Group | null => {
  const { party } = useGlobalStore.getState()
  const partyMemberId = party[partyMemberIndex]
  if (partyMemberId === undefined) {
    return null
  }
  const partyMemberGroup = scene.getObjectByName(`party--${partyMemberId}`) as Object3D
  if (!partyMemberGroup) {
    return null
  }

  return partyMemberGroup.parent as Group
}

export const getPlayerEntity = (scene: Scene): Group | null => {
  const { party } = useGlobalStore.getState()
  const partyMemberId = party[0]

  const groupWrapper = scene.getObjectByName(`party--${partyMemberId}`) as Group
  if (!groupWrapper) {
    console.warn('Player entity not found in scene')
    return null
  }

  return groupWrapper.parent as Group
}
const CORNER_VECTOR_1 = new Vector3()
const CORNER_VECTOR_2 = new Vector3()
const CORNER_VECTOR_3 = new Vector3()
const CORNER_VECTOR_4 = new Vector3()
const CORNER_VECTOR_CENTER = new Vector3()
export const getLowestTriangleBelowMesh = (boundingBox: Box3) => {
  const walkmeshController = useGlobalStore.getState().walkmeshController!

  const bottomZ = boundingBox.min.z
  const positions = [
    CORNER_VECTOR_1.set(boundingBox.min.x, boundingBox.min.y, bottomZ),
    CORNER_VECTOR_2.set(boundingBox.max.x, boundingBox.min.y, bottomZ),
    CORNER_VECTOR_3.set(boundingBox.min.x, boundingBox.max.y, bottomZ),
    CORNER_VECTOR_4.set(boundingBox.max.x, boundingBox.max.y, bottomZ),
    CORNER_VECTOR_CENTER.set(
      (boundingBox.min.x + boundingBox.max.x) / 2,
      (boundingBox.min.y + boundingBox.max.y) / 2,
      bottomZ,
    ),
  ]

  let lowestTriangleId: null | number = null
  let lowestZ = Infinity
  let foundCornerPosition: null | Vector3 = null

  for (const position of positions) {
    const triangleId = walkmeshController.getTriangleForPosition(position)

    if (triangleId === -1) {
      continue
    }
    if (triangleId !== null) {
      const triangleCenter = walkmeshController.getTriangleCentre(triangleId)

      if (triangleCenter.z < lowestZ) {
        lowestZ = triangleCenter.z
        lowestTriangleId = triangleId
        foundCornerPosition = position.clone()
      }
    }
  }

  if (lowestTriangleId === null) {
    return null
  }

  return {
    cornerPosition: foundCornerPosition!,
    triangleId: lowestTriangleId,
  }
}
