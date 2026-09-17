import { MathUtils, Object3D, Vector3 } from 'three'

import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX, WORLDMAP_SCALE } from '../constants'
import { queryTerrain, queryTerrainFaces, selectTopFace, selectTopTriangle, TerrainTriangle } from '../terrain'

export type ShipPose = {
  altitude: number
  x: number
  z: number
}

export const wrapMapX = (x: number) => MathUtils.euclideanModulo(x, WORLD_WIDTH_PSX)
export const wrapMapZ = (z: number) => MathUtils.euclideanModulo(z, WORLD_DEPTH_PSX)

export const readShipPose = (position: Vector3): ShipPose => ({
  altitude: Math.round(-position.y / WORLDMAP_SCALE),
  x: wrapMapX(Math.round(position.x / WORLDMAP_SCALE)),
  z: wrapMapZ(Math.round(position.z / WORLDMAP_SCALE)),
})

export const writeShipPose = (position: Vector3, pose: ShipPose) => {
  position.set(pose.x * WORLDMAP_SCALE, -pose.altitude * WORLDMAP_SCALE, pose.z * WORLDMAP_SCALE)
}

export const getTriangleAltitude = (triangle: TerrainTriangle) => Math.round(triangle.psxY)

export const findTopTriangle = (scene: Object3D, x: number, z: number) =>
  selectTopTriangle(queryTerrain(scene, wrapMapX(x) * WORLDMAP_SCALE, wrapMapZ(z) * WORLDMAP_SCALE))

export const findTopFace = (scene: Object3D, x: number, z: number) =>
  selectTopFace(queryTerrainFaces(scene, wrapMapX(x) * WORLDMAP_SCALE, wrapMapZ(z) * WORLDMAP_SCALE))

export const findGroundAltitude = (scene: Object3D, x: number, z: number) => {
  const triangle = findTopTriangle(scene, x, z)
  return triangle ? getTriangleAltitude(triangle) : undefined
}
