import { MathUtils, Object3D, Vector3 } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import { WORLD_WRAP_X, WORLD_WRAP_Z, WORLDMAP_SCALE } from '../constants'
import { isOnFootAccessible, queryTerrain, selectOnFootTriangle, TerrainTriangle } from '../terrain'
import {
  BLOCKED_TICKS_BEFORE_OTHER_SLIDE_SET,
  SLIDE_ANGLE_STEP_PSX,
  SLIDE_GROUP_COUNT,
  SLIDE_PROBE_OFFSET_PSX,
} from './constants'
import { isVelocityZero, OnFootVelocity } from './onFootMotion'
import { psxToRadians } from './playerAngles'

export type OnFootStep = {
  set: SlideSet
  slideAnglePsx: number
  triangle: TerrainTriangle
  x: number
  z: number
}

export type SlideSet = 0 | 1

type StepRequest = {
  blockedTicks: number
  currentGroundType: number | undefined
  currentPsxY: number
  preferredSet: SlideSet
  velocity: OnFootVelocity
  x: number
  z: number
}

const _yAxis = new Vector3(0, 1, 0)
const _step = new Vector3()

const PROBE_OFFSET = SLIDE_PROBE_OFFSET_PSX * WORLDMAP_SCALE

const PROBE_OFFSETS: readonly (readonly [number, number])[] = [
  [-PROBE_OFFSET, 0],
  [0, PROBE_OFFSET],
  [PROBE_OFFSET, 0],
  [0, -PROBE_OFFSET],
]

const SLIDE_GROUPS = Array.from({ length: SLIDE_GROUP_COUNT }, (_, group) => group)

export const getPreferredSlideSet = (padButtons: number, previousPadButtons: number, currentSet: SlideSet) => {
  const pressed = padButtons & ~previousPadButtons
  if ((pressed & WORLDMAP_PAD_BITS.left) !== 0) {
    return 0
  }
  if ((pressed & WORLDMAP_PAD_BITS.right) !== 0) {
    return 1
  }
  return currentSet
}

const getOtherSlideSet = (set: SlideSet): SlideSet => (set === 0 ? 1 : 0)

const getSlideAnglePsx = (set: SlideSet, group: number) =>
  group * (set === 1 ? SLIDE_ANGLE_STEP_PSX : -SLIDE_ANGLE_STEP_PSX)

const wrapWorldX = (x: number) => MathUtils.euclideanModulo(x, WORLD_WRAP_X)
const wrapWorldZ = (z: number) => MathUtils.euclideanModulo(z, WORLD_WRAP_Z)

const findOnFootGround = (root: Object3D, x: number, z: number, request: StepRequest) => {
  const triangle = selectOnFootTriangle(queryTerrain(root, x, z), request.currentPsxY, request.currentGroundType)
  return triangle && isOnFootAccessible(triangle) ? triangle : undefined
}

const isSurroundedByGround = (root: Object3D, x: number, z: number, request: StepRequest) =>
  PROBE_OFFSETS.every(
    ([offsetX, offsetZ]) =>
      findOnFootGround(root, wrapWorldX(x + offsetX), wrapWorldZ(z + offsetZ), request) !== undefined,
  )

const tryStepAtAngle = (root: Object3D, request: StepRequest, set: SlideSet, slideAnglePsx: number) => {
  _step
    .set(request.velocity.x, 0, request.velocity.z)
    .multiplyScalar(WORLDMAP_SCALE)
    .applyAxisAngle(_yAxis, psxToRadians(-slideAnglePsx))
  const x = wrapWorldX(request.x + _step.x)
  const z = wrapWorldZ(request.z + _step.z)
  const triangle = findOnFootGround(root, x, z, request)
  if (!triangle || !isSurroundedByGround(root, x, z, request)) {
    return undefined
  }
  return { set, slideAnglePsx, triangle, x, z }
}

const trySlideSet = (root: Object3D, request: StepRequest, set: SlideSet) =>
  SLIDE_GROUPS.reduce<OnFootStep | undefined>(
    (found, group) => found ?? tryStepAtAngle(root, request, set, getSlideAnglePsx(set, group)),
    undefined,
  )

const settleInPlace = (root: Object3D, request: StepRequest): OnFootStep | undefined => {
  const triangle = findOnFootGround(root, request.x, request.z, request)
  return triangle && { set: request.preferredSet, slideAnglePsx: 0, triangle, x: request.x, z: request.z }
}

export const resolveOnFootStep = (root: Object3D, request: StepRequest) => {
  if (isVelocityZero(request.velocity)) {
    return settleInPlace(root, request)
  }
  const preferred = trySlideSet(root, request, request.preferredSet)
  if (preferred || request.blockedTicks < BLOCKED_TICKS_BEFORE_OTHER_SLIDE_SET) {
    return preferred
  }
  return trySlideSet(root, request, getOtherSlideSet(request.preferredSet))
}
