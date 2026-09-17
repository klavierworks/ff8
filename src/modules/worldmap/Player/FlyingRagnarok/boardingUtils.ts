import { Object3D } from 'three'

import { CHARACTER_FOOTPRINT, RAGNAROK_FOOTPRINT } from '../../../../constants/worldmapEntities'
import { CollisionBox, findCollidingEntity } from '../../Entities/entityCollision'
import { EntityRecord, getAllEntities } from '../../Scripts/state'
import { isOnFootAccessible, TerrainTriangle } from '../../terrain'
import {
  LANDING_SPOT_ANGLE_STEP,
  LANDING_SPOT_DISTANCE,
  LANDING_SPOT_FIRST_ANGLE,
  LANDING_SPOT_HALF_SIZE,
  LANDING_SPOT_HEIGHT_TOLERANCE,
  LANDING_SPOT_TRIES,
  RAGNAROK_ACCESS_BIT,
  RAGNAROK_BOARDING_HEIGHT_TOLERANCE,
  RAGNAROK_BOARDING_REACH,
  RAGNAROK_BOX_HALF_SIZE,
} from '../constants'
import { wrapPsxAngle } from '../playerAngles'
import { convertMapXToEntityX, convertMapZToEntityY } from '../playerUtils'
import { calculateHeadingStep } from './flightUtils'
import { getPartyEntityIndex, getRagnarokEntityIndex, readRagnarokEntityPose } from './ragnarokEntity'
import { findTopTriangle, getTriangleAltitude, ShipPose, wrapMapX, wrapMapZ } from './shipPose'

type BoardingRequest = {
  entities: readonly EntityRecord[]
  player: ShipPose
  playerTriangle: TerrainTriangle | undefined
}

const PLAYER_HALF_SIZE = LANDING_SPOT_HALF_SIZE

const LANDING_PROBE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-LANDING_SPOT_HALF_SIZE, 0],
  [0, LANDING_SPOT_HALF_SIZE],
  [LANDING_SPOT_HALF_SIZE, 0],
  [0, -LANDING_SPOT_HALF_SIZE],
]

const allowsRagnarok = (triangle: TerrainTriangle) => (triangle.triggerFlags & RAGNAROK_ACCESS_BIT) !== 0

const buildCollisionBox = (pose: ShipPose, halfSize: number, height: number): CollisionBox => ({
  altitude: pose.altitude,
  halfSize,
  height,
  x: convertMapXToEntityX(pose.x),
  y: convertMapZToEntityY(pose.z),
})

const getExcludedIndices = () => [getPartyEntityIndex(), getRagnarokEntityIndex()]

export const isShipBlockedByEntity = (pose: ShipPose) =>
  findCollidingEntity(getAllEntities(), {
    box: buildCollisionBox(pose, RAGNAROK_BOX_HALF_SIZE, RAGNAROK_FOOTPRINT.height),
    excludedIndices: getExcludedIndices(),
    isHeightIgnored: false,
    reach: 0,
  }) >= 0

const findEntityWithinBoardingReach = ({ entities, player }: BoardingRequest) =>
  findCollidingEntity(entities, {
    box: buildCollisionBox(player, PLAYER_HALF_SIZE, CHARACTER_FOOTPRINT.height),
    excludedIndices: [getPartyEntityIndex()],
    isHeightIgnored: false,
    reach: RAGNAROK_BOARDING_REACH,
  })

const isPlayerGroundBoardable = (triangle: TerrainTriangle | undefined): triangle is TerrainTriangle =>
  triangle !== undefined && allowsRagnarok(triangle) && isOnFootAccessible(triangle)

export const findBoardableRagnarok = (request: BoardingRequest): EntityRecord | undefined => {
  const shipIndex = getRagnarokEntityIndex()
  const ship = request.entities[shipIndex]
  if (!ship || findEntityWithinBoardingReach(request) !== shipIndex) {
    return undefined
  }
  const { playerTriangle } = request
  if (!isPlayerGroundBoardable(playerTriangle)) {
    return undefined
  }
  if (Math.abs(ship.positionVerticalY - getTriangleAltitude(playerTriangle)) >= RAGNAROK_BOARDING_HEIGHT_TOLERANCE) {
    return undefined
  }
  return isShipBlockedByEntity(readRagnarokEntityPose(ship)) ? undefined : ship
}

const isProbeLandable = (triangle: TerrainTriangle | undefined, shipGround: number) =>
  triangle === undefined ||
  (isOnFootAccessible(triangle) &&
    allowsRagnarok(triangle) &&
    Math.abs(getTriangleAltitude(triangle) - shipGround) < LANDING_SPOT_HEIGHT_TOLERANCE)

const isSpotBlockedByEntity = (spot: ShipPose) =>
  findCollidingEntity(getAllEntities(), {
    box: buildCollisionBox(spot, LANDING_SPOT_HALF_SIZE, 0),
    excludedIndices: getExcludedIndices(),
    isHeightIgnored: true,
    reach: 0,
  }) >= 0

const tryLandingSpot = (scene: Object3D, ship: ShipPose, shipGround: number, angle: number): ShipPose | undefined => {
  const step = calculateHeadingStep(LANDING_SPOT_DISTANCE, angle)
  const x = wrapMapX(ship.x + step.x)
  const z = wrapMapZ(ship.z + step.z)
  const triangles = LANDING_PROBE_OFFSETS.map(([offsetX, offsetZ]) => findTopTriangle(scene, x + offsetX, z + offsetZ))
  const centre = triangles[0]
  if (!centre || !triangles.every((triangle) => isProbeLandable(triangle, shipGround))) {
    return undefined
  }
  const spot = { altitude: getTriangleAltitude(centre), x, z }
  return isSpotBlockedByEntity(spot) ? undefined : spot
}

const LANDING_SPOT_ATTEMPTS = Array.from({ length: LANDING_SPOT_TRIES }, (_, attempt) => attempt)

export const findLandingSpot = (scene: Object3D, ship: ShipPose, shipYaw: number): ShipPose | undefined => {
  const shipTriangle = findTopTriangle(scene, ship.x, ship.z)
  if (!shipTriangle || !allowsRagnarok(shipTriangle)) {
    return undefined
  }
  const shipGround = getTriangleAltitude(shipTriangle)
  return LANDING_SPOT_ATTEMPTS.reduce<ShipPose | undefined>(
    (found, attempt) =>
      found ??
      tryLandingSpot(
        scene,
        ship,
        shipGround,
        wrapPsxAngle(shipYaw + LANDING_SPOT_FIRST_ANGLE + attempt * LANDING_SPOT_ANGLE_STEP),
      ),
    undefined,
  )
}
