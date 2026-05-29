import { BufferAttribute, InterleavedBufferAttribute, Material, Mesh, Raycaster, Scene, Vector3 } from 'three'

import {
  SEGMENT_WORLD_SIZE,
  WALKMESH_USER_DATA_KEY,
  WORLD_GRID_COLS,
  WORLD_GRID_ROWS,
  WORLDMAP_SCALE,
} from '../constants'
import { findFlagsAttribute } from '../meshFlags'

const PSX_X_HALF_WORLD = (WORLD_GRID_COLS / 2) * SEGMENT_WORLD_SIZE
const PSX_Z_HALF_WORLD = (WORLD_GRID_ROWS / 2) * SEGMENT_WORLD_SIZE

export const psxXToWorld = (psxX: number) => (psxX + PSX_X_HALF_WORLD) * WORLDMAP_SCALE
export const psxZToWorld = (psxZ: number) => (psxZ + PSX_Z_HALF_WORLD) * WORLDMAP_SCALE

export const PLAYER_Y_OFFSET = 0

const ON_FOOT_MATERIALS: ReadonlySet<string> = new Set(['land', 'land_alpha', 'road', 'road_alpha'])

const ON_FOOT_FLAG_BIT = 0x40

const CANOPY_GROUND_TYPES: ReadonlySet<number> = new Set([4])
const CANOPY_BAND_THREE = -45 * WORLDMAP_SCALE
const CANOPY_HEAD_CLEARANCE = 0.29

const GROUND_RAY_ORIGIN_Y = 10
const GROUND_RAY_FAR = 20

const _origin = new Vector3()
const _direction = new Vector3(0, -1, 0)
const _raycaster = new Raycaster()
_raycaster.far = GROUND_RAY_FAR

const isOnFootMaterial = (material: Material | Material[]): boolean => {
  if (Array.isArray(material)) {
    return material.some((entry) => ON_FOOT_MATERIALS.has(entry.name))
  }
  return ON_FOOT_MATERIALS.has(material.name)
}

const isOnFootTriangle = (flags: BufferAttribute | InterleavedBufferAttribute, a: number, b: number, c: number) => {
  const flagA = flags.getY(a)
  const flagB = flags.getY(b)
  const flagC = flags.getY(c)
  return (flagA & ON_FOOT_FLAG_BIT) !== 0 && (flagB & ON_FOOT_FLAG_BIT) !== 0 && (flagC & ON_FOOT_FLAG_BIT) !== 0
}

const isCanopyTriangle = (flags: BufferAttribute | InterleavedBufferAttribute, a: number, b: number, c: number) => {
  return (
    CANOPY_GROUND_TYPES.has(flags.getZ(a)) &&
    CANOPY_GROUND_TYPES.has(flags.getZ(b)) &&
    CANOPY_GROUND_TYPES.has(flags.getZ(c))
  )
}

export const findGroundY = (scene: Scene, x: number, z: number): number | undefined => {
  _origin.set(x, GROUND_RAY_ORIGIN_Y, z)
  _raycaster.set(_origin, _direction)
  const hits = _raycaster.intersectObjects(scene.children, true)
  let lowestY: number | undefined
  hits.forEach((hit) => {
    const mesh = hit.object as Mesh
    if (hit.object.userData[WALKMESH_USER_DATA_KEY] !== true) {
      return
    }
    if (!isOnFootMaterial(mesh.material)) {
      return
    }
    const flags = findFlagsAttribute(mesh)
    const hasOnFootFlag = !flags || !hit.face || isOnFootTriangle(flags, hit.face.a, hit.face.b, hit.face.c)
    const isCanopy = flags && hit.face && isCanopyTriangle(flags, hit.face.a, hit.face.b, hit.face.c)
    if (!hasOnFootFlag && !isCanopy) {
      return
    }
    const effectiveY =
      !hasOnFootFlag && isCanopy ? hit.point.y - CANOPY_HEAD_CLEARANCE - CANOPY_BAND_THREE : hit.point.y
    if (lowestY === undefined || effectiveY < lowestY) {
      lowestY = effectiveY
    }
  })
  return lowestY
}
