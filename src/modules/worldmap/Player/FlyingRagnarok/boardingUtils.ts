import { Object3D } from 'three'

import { CHARACTER_FOOTPRINT, RAGNAROK_FOOTPRINT } from '../../../../constants/worldmapEntities'
import { findCollidingEntity } from '../../Entities/entityCollision'
import { EntityRecord, getAllEntities } from '../../Scripts/state'
import { isOnFootAccessible, TerrainTriangle } from '../../terrain'
import {
  LANDING_SPOT_DISTANCE,
  LANDING_SPOT_HALF_SIZE,
  RAGNAROK_ACCESS_BIT,
  RAGNAROK_BOARDING_HEIGHT_TOLERANCE,
  RAGNAROK_BOARDING_REACH,
  RAGNAROK_BOX_HALF_SIZE,
} from '../constants'
import { buildCollisionBox, findDisembarkSpot } from '../disembarkUtils'
import { getTriangleAltitude, ShipPose } from '../shipPose'
import { getPartyEntityIndex, getRagnarokEntityIndex, readRagnarokEntityPose } from './ragnarokEntity'

type BoardingRequest = {
  entities: readonly EntityRecord[]
  player: ShipPose
  playerTriangle: TerrainTriangle | undefined
}

const PLAYER_HALF_SIZE = LANDING_SPOT_HALF_SIZE

const allowsRagnarok = (triangle: TerrainTriangle) => (triangle.triggerFlags & RAGNAROK_ACCESS_BIT) !== 0

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

export const findLandingSpot = (scene: Object3D, ship: ShipPose, shipYaw: number) =>
  findDisembarkSpot(scene, ship, shipYaw, {
    canLeaveFrom: allowsRagnarok,
    distance: LANDING_SPOT_DISTANCE,
    excludedIndices: getExcludedIndices(),
  })
