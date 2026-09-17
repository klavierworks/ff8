import { MathUtils, Object3D, Vector3 } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import { WORLD_WRAP_X, WORLD_WRAP_Z, WORLDMAP_SCALE } from '../constants'
import { hasAccessBit, queryTerrain, TerrainTriangle } from '../terrain'
import { BLOCKED_TICKS_BEFORE_OTHER_SLIDE_SET, SLIDE_ANGLE_STEP_PSX, SLIDE_GROUP_COUNT } from './constants'
import { isVelocityZero, OnFootVelocity } from './onFootMotion'
import { psxToRadians } from './playerAngles'

export type GroundProfile = {
  accessBit: number
  probeOffsetPsx: number
  selectTriangle: (triangles: readonly TerrainTriangle[], request: GroundStepRequest) => TerrainTriangle | undefined
}

export type GroundStep = {
  set: SlideSet
  slideAnglePsx: number
  triangle: TerrainTriangle
  x: number
  z: number
}

export type GroundStepRequest = {
  blockedTicks: number
  currentGroundType: number | undefined
  currentPsxY: number
  preferredSet: SlideSet
  profile: GroundProfile
  velocity: OnFootVelocity
  x: number
  z: number
}

export type SlideSet = 0 | 1

const _yAxis = new Vector3(0, 1, 0)
const _step = new Vector3()

const SLIDE_GROUPS = Array.from({ length: SLIDE_GROUP_COUNT }, (_, group) => group)

const getProbeOffsets = (probeOffsetPsx: number) => {
  const offset = probeOffsetPsx * WORLDMAP_SCALE
  return [
    [-offset, 0],
    [0, offset],
    [offset, 0],
    [0, -offset],
  ] as const
}

export const getPressedSlideSet = (pressed: number, currentSet: SlideSet) => {
  if ((pressed & WORLDMAP_PAD_BITS.left) !== 0) {
    return 0
  }
  if ((pressed & WORLDMAP_PAD_BITS.right) !== 0) {
    return 1
  }
  return currentSet
}

export const getHeldSlideSet = (padButtons: number, currentSet: SlideSet) => {
  if ((padButtons & WORLDMAP_PAD_BITS.left) !== 0) {
    return 0
  }
  if ((padButtons & WORLDMAP_PAD_BITS.right) !== 0) {
    return 1
  }
  return currentSet
}

const getOtherSlideSet = (set: SlideSet): SlideSet => (set === 0 ? 1 : 0)

const getSlideAnglePsx = (set: SlideSet, group: number) =>
  group * (set === 1 ? SLIDE_ANGLE_STEP_PSX : -SLIDE_ANGLE_STEP_PSX)

const wrapWorldX = (x: number) => MathUtils.euclideanModulo(x, WORLD_WRAP_X)
const wrapWorldZ = (z: number) => MathUtils.euclideanModulo(z, WORLD_WRAP_Z)

const findGround = (root: Object3D, x: number, z: number, request: GroundStepRequest) => {
  const triangle = request.profile.selectTriangle(queryTerrain(root, x, z), request)
  return triangle && hasAccessBit(triangle, request.profile.accessBit) ? triangle : undefined
}

const isSurroundedByGround = (root: Object3D, x: number, z: number, request: GroundStepRequest) =>
  getProbeOffsets(request.profile.probeOffsetPsx).every(
    ([offsetX, offsetZ]) => findGround(root, wrapWorldX(x + offsetX), wrapWorldZ(z + offsetZ), request) !== undefined,
  )

const tryStepAtAngle = (root: Object3D, request: GroundStepRequest, set: SlideSet, slideAnglePsx: number) => {
  _step
    .set(request.velocity.x, 0, request.velocity.z)
    .multiplyScalar(WORLDMAP_SCALE)
    .applyAxisAngle(_yAxis, psxToRadians(-slideAnglePsx))
  const x = wrapWorldX(request.x + _step.x)
  const z = wrapWorldZ(request.z + _step.z)
  const triangle = findGround(root, x, z, request)
  if (!triangle || !isSurroundedByGround(root, x, z, request)) {
    return undefined
  }
  return { set, slideAnglePsx, triangle, x, z }
}

const trySlideSet = (root: Object3D, request: GroundStepRequest, set: SlideSet) =>
  SLIDE_GROUPS.reduce<GroundStep | undefined>(
    (found, group) => found ?? tryStepAtAngle(root, request, set, getSlideAnglePsx(set, group)),
    undefined,
  )

const settleInPlace = (root: Object3D, request: GroundStepRequest): GroundStep | undefined => {
  const triangle = findGround(root, request.x, request.z, request)
  return triangle && { set: request.preferredSet, slideAnglePsx: 0, triangle, x: request.x, z: request.z }
}

export const resolveGroundStep = (root: Object3D, request: GroundStepRequest) => {
  if (isVelocityZero(request.velocity)) {
    return settleInPlace(root, request)
  }
  const preferred = trySlideSet(root, request, request.preferredSet)
  if (preferred || request.blockedTicks < BLOCKED_TICKS_BEFORE_OTHER_SLIDE_SET) {
    return preferred
  }
  return trySlideSet(root, request, getOtherSlideSet(request.preferredSet))
}
