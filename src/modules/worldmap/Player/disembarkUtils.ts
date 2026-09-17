import { Object3D } from 'three'

import { CollisionBox, findCollidingEntity } from '../Entities/entityCollision'
import { getAllEntities } from '../Scripts/state'
import { isOnFootAccessible, TerrainTriangle } from '../terrain'
import {
  LANDING_SPOT_ANGLE_STEP,
  LANDING_SPOT_FIRST_ANGLE,
  LANDING_SPOT_HALF_SIZE,
  LANDING_SPOT_HEIGHT_TOLERANCE,
  LANDING_SPOT_TRIES,
} from './constants'
import { calculateHeadingStep } from './drivingUtils'
import { wrapPsxAngle } from './playerAngles'
import { convertMapXToEntityX, convertMapZToEntityY } from './playerUtils'
import { findTopTriangle, getTriangleAltitude, ShipPose, wrapMapX, wrapMapZ } from './shipPose'

export type DisembarkRule = {
  canLeaveFrom: (triangle: TerrainTriangle) => boolean
  distance: number
  excludedIndices: readonly number[]
}

const PROBE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-LANDING_SPOT_HALF_SIZE, 0],
  [0, LANDING_SPOT_HALF_SIZE],
  [LANDING_SPOT_HALF_SIZE, 0],
  [0, -LANDING_SPOT_HALF_SIZE],
]

const ATTEMPTS = Array.from({ length: LANDING_SPOT_TRIES }, (_, attempt) => attempt)

export const buildCollisionBox = (pose: ShipPose, halfSize: number, height: number): CollisionBox => ({
  altitude: pose.altitude,
  halfSize,
  height,
  x: convertMapXToEntityX(pose.x),
  y: convertMapZToEntityY(pose.z),
})

const isProbeLandable = (triangle: TerrainTriangle | undefined, vehicleGround: number, rule: DisembarkRule) =>
  triangle === undefined ||
  (isOnFootAccessible(triangle) &&
    rule.canLeaveFrom(triangle) &&
    Math.abs(getTriangleAltitude(triangle) - vehicleGround) < LANDING_SPOT_HEIGHT_TOLERANCE)

const isSpotBlockedByEntity = (spot: ShipPose, rule: DisembarkRule) =>
  findCollidingEntity(getAllEntities(), {
    box: buildCollisionBox(spot, LANDING_SPOT_HALF_SIZE, 0),
    excludedIndices: rule.excludedIndices,
    isHeightIgnored: true,
    reach: 0,
  }) >= 0

const trySpot = (scene: Object3D, pose: ShipPose, vehicleGround: number, angle: number, rule: DisembarkRule) => {
  const step = calculateHeadingStep(rule.distance, angle)
  const x = wrapMapX(pose.x + step.x)
  const z = wrapMapZ(pose.z + step.z)
  const triangles = PROBE_OFFSETS.map(([offsetX, offsetZ]) => findTopTriangle(scene, x + offsetX, z + offsetZ))
  const centre = triangles[0]
  if (!centre || !triangles.every((triangle) => isProbeLandable(triangle, vehicleGround, rule))) {
    return undefined
  }
  const spot = { altitude: getTriangleAltitude(centre), x, z }
  return isSpotBlockedByEntity(spot, rule) ? undefined : spot
}

export const findDisembarkSpot = (scene: Object3D, pose: ShipPose, yaw: number, rule: DisembarkRule) => {
  const vehicleTriangle = findTopTriangle(scene, pose.x, pose.z)
  if (!vehicleTriangle || !rule.canLeaveFrom(vehicleTriangle)) {
    return undefined
  }
  const vehicleGround = getTriangleAltitude(vehicleTriangle)
  return ATTEMPTS.reduce<ShipPose | undefined>(
    (found, attempt) =>
      found ??
      trySpot(
        scene,
        pose,
        vehicleGround,
        wrapPsxAngle(yaw + LANDING_SPOT_FIRST_ANGLE + attempt * LANDING_SPOT_ANGLE_STEP),
        rule,
      ),
    undefined,
  )
}
