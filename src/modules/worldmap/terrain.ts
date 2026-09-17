import { Mesh, Object3D, Raycaster, Vector3 } from 'three'

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

export type TerrainTriangle = {
  accessFlags: number
  groundType: number
  psxY: number
  triggerFlags: number
  worldY: number
}

const _origin = new Vector3()
const _down = new Vector3(0, -1, 0)
const _raycaster = new Raycaster(undefined, undefined, 0, TERRAIN_RAY_FAR)

export const psxHeightToWorldY = (psxY: number) => -psxY * WORLDMAP_SCALE
export const worldYToPsxHeight = (worldY: number) => -worldY / WORLDMAP_SCALE

export const queryTerrain = (root: Object3D, x: number, z: number) => {
  _raycaster.set(_origin.set(x, TERRAIN_RAY_ORIGIN_Y, z), _down)
  return _raycaster.intersectObjects(root.children, true).flatMap((hit) => {
    if (hit.object.userData[WALKMESH_USER_DATA_KEY] !== true || !hit.face) {
      return []
    }
    const flags = findFlagsAttribute(hit.object as Mesh)
    if (!flags) {
      return []
    }
    return [
      {
        accessFlags: flags.getY(hit.face.a),
        groundType: flags.getZ(hit.face.a),
        psxY: worldYToPsxHeight(hit.point.y),
        triggerFlags: flags.getX(hit.face.a),
        worldY: hit.point.y,
      },
    ]
  })
}

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

export const getOnFootPsxHeight = (triangle: TerrainTriangle) =>
  isCanopyGroundType(triangle.groundType) ? triangle.psxY + CANOPY_PLAYER_DEPTH_PSX : triangle.psxY
