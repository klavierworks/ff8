import {
  BufferAttribute,
  Face,
  InterleavedBufferAttribute,
  Intersection,
  Mesh,
  Object3D,
  Raycaster,
  Vector3,
} from 'three'

import {
  CANOPY_GROUND_TYPE_MAX,
  CANOPY_PLAYER_DEPTH_PSX,
  ON_FOOT_ACCESS_BIT,
  ON_FOOT_HEIGHT_TOLERANCE_PSX,
  TERRAIN_RAY_FAR,
  TERRAIN_RAY_ORIGIN_Y,
  WALKMESH_USER_DATA_KEY,
  WORLDMAP_SCALE,
} from './constants'
import { findFlagsAttribute } from './meshFlags'

export type TerrainFace = {
  key: string
  triangle: TerrainTriangle
  vertices: readonly [TerrainPoint, TerrainPoint, TerrainPoint]
}

export type TerrainPoint = {
  altitude: number
  x: number
  z: number
}

export type TerrainTriangle = {
  accessFlags: number
  groundType: number
  psxY: number
  triggerFlags: number
  worldY: number
}

type FlagsAttribute = BufferAttribute | InterleavedBufferAttribute

const _origin = new Vector3()
const _down = new Vector3(0, -1, 0)
const _vertex = new Vector3()
const _raycaster = new Raycaster(undefined, undefined, 0, TERRAIN_RAY_FAR)

export const psxHeightToWorldY = (psxY: number) => -psxY * WORLDMAP_SCALE
export const worldYToPsxHeight = (worldY: number) => -worldY / WORLDMAP_SCALE

const buildTerrainTriangle = (hit: Intersection, face: Face, flags: FlagsAttribute): TerrainTriangle => ({
  accessFlags: flags.getY(face.a),
  groundType: flags.getZ(face.a),
  psxY: worldYToPsxHeight(hit.point.y),
  triggerFlags: flags.getX(face.a),
  worldY: hit.point.y,
})

const readVertexPoint = (mesh: Mesh, vertexIndex: number): TerrainPoint => {
  _vertex.fromBufferAttribute(mesh.geometry.getAttribute('position'), vertexIndex).applyMatrix4(mesh.matrixWorld)
  return {
    altitude: worldYToPsxHeight(_vertex.y),
    x: _vertex.x / WORLDMAP_SCALE,
    z: _vertex.z / WORLDMAP_SCALE,
  }
}

const intersectWalkmesh = <T>(
  root: Object3D,
  x: number,
  z: number,
  build: (hit: Intersection, mesh: Mesh, face: Face, flags: FlagsAttribute) => T,
) => {
  _raycaster.set(_origin.set(x, TERRAIN_RAY_ORIGIN_Y, z), _down)
  return _raycaster.intersectObjects(root.children, true).flatMap((hit) => {
    if (hit.object.userData[WALKMESH_USER_DATA_KEY] !== true || !hit.face) {
      return []
    }
    const mesh = hit.object as Mesh
    const flags = findFlagsAttribute(mesh)
    return flags ? [build(hit, mesh, hit.face, flags)] : []
  })
}

export const queryTerrain = (root: Object3D, x: number, z: number) =>
  intersectWalkmesh(root, x, z, (hit, _mesh, face, flags) => buildTerrainTriangle(hit, face, flags))

export const queryTerrainFaces = (root: Object3D, x: number, z: number) =>
  intersectWalkmesh(
    root,
    x,
    z,
    (hit, mesh, face, flags): TerrainFace => ({
      key: `${mesh.uuid}:${hit.faceIndex}`,
      triangle: buildTerrainTriangle(hit, face, flags),
      vertices: [readVertexPoint(mesh, face.a), readVertexPoint(mesh, face.b), readVertexPoint(mesh, face.c)],
    }),
  )

export const isCanopyGroundType = (groundType: number) => groundType <= CANOPY_GROUND_TYPE_MAX

export const hasAccessBit = (triangle: TerrainTriangle, bit: number) => (triangle.accessFlags & bit) !== 0

export const isOnFootAccessible = (triangle: TerrainTriangle) => hasAccessBit(triangle, ON_FOOT_ACCESS_BIT)

export const isGroundTypeCanopy = (groundType: number | undefined) =>
  groundType !== undefined && isCanopyGroundType(groundType)

const getHeightDistance = (triangle: TerrainTriangle, referenceY: number) => Math.abs(triangle.psxY - referenceY)

const selectClosestTriangle = (triangles: readonly TerrainTriangle[], referenceY: number) =>
  triangles.reduce<TerrainTriangle | undefined>(
    (best, triangle) =>
      !best || getHeightDistance(triangle, referenceY) < getHeightDistance(best, referenceY) ? triangle : best,
    undefined,
  )

export const selectOnFootTriangle = (
  triangles: readonly TerrainTriangle[],
  currentPsxY: number,
  currentGroundType: number | undefined,
) => {
  const isStandingOnCanopy = isGroundTypeCanopy(currentGroundType)
  const referenceY = isStandingOnCanopy ? currentPsxY - CANOPY_PLAYER_DEPTH_PSX : currentPsxY
  const reachable = triangles.filter(
    (triangle) =>
      isStandingOnCanopy ||
      isCanopyGroundType(triangle.groundType) ||
      getHeightDistance(triangle, referenceY) < ON_FOOT_HEIGHT_TOLERANCE_PSX,
  )
  return selectClosestTriangle(reachable, referenceY)
}

export const selectTopTriangle = (triangles: readonly TerrainTriangle[]) =>
  triangles.reduce<TerrainTriangle | undefined>(
    (top, triangle) => (!top || triangle.psxY < top.psxY ? triangle : top),
    undefined,
  )

export const selectTopFace = (faces: readonly TerrainFace[]) =>
  faces.reduce<TerrainFace | undefined>(
    (top, face) => (!top || face.triangle.psxY < top.triangle.psxY ? face : top),
    undefined,
  )

export const getOnFootPsxHeight = (triangle: TerrainTriangle) =>
  isCanopyGroundType(triangle.groundType) ? triangle.psxY + CANOPY_PLAYER_DEPTH_PSX : triangle.psxY
