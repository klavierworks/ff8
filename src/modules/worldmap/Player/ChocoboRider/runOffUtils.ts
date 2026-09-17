import { Camera, Frustum, Matrix4, Object3D, Vector3 } from 'three'

import {
  CHOCOBO_RUN_OFF_CANOPY_DEPTH,
  CHOCOBO_RUN_OFF_SPEED,
  CHOCOBO_RUN_OFF_WAYPOINT_REACH,
} from '../../../../constants/worldmapVehicles'
import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX } from '../../constants'
import { wrapDelta } from '../../Entities/entityCollision'
import { isCanopyGroundType, TerrainTriangle } from '../../terrain'
import { calculateHeadingStep } from '../drivingUtils'
import { calculateOffsetHeading } from '../playerAngles'
import { findTopTriangle, getTriangleAltitude, wrapMapX, wrapMapZ, writeShipPose } from '../shipPose'
import { RunOffWaypoint } from './runOffPathUtils'

export type ChocoboPose = {
  altitude: number
  heading: number
  triangle: TerrainTriangle | undefined
  x: number
  z: number
}

type RunningStep = {
  pose: ChocoboPose
  waypointIndex: number
}

const _frustum = new Frustum()
const _viewProjection = new Matrix4()
const _point = new Vector3()

export const hasRunOffWaypointsLeft = (path: readonly RunOffWaypoint[], waypointIndex: number) =>
  path.length - 1 > waypointIndex

export const isChocoboPoseInView = (camera: Camera, pose: ChocoboPose) => {
  _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  _frustum.setFromProjectionMatrix(_viewProjection)
  writeShipPose(_point, pose)
  return _frustum.containsPoint(_point)
}

const calculateGroundAltitude = (triangle: TerrainTriangle | undefined, fallback: number) => {
  if (!triangle) {
    return fallback
  }
  const altitude = getTriangleAltitude(triangle)
  return isCanopyGroundType(triangle.groundType) ? altitude + CHOCOBO_RUN_OFF_CANOPY_DEPTH : altitude
}

// The original adds the signed offsets rather than their magnitudes, so a waypoint behind or to one side counts as reached.
const isWaypointReached = (dx: number, dz: number) => dx + dz < CHOCOBO_RUN_OFF_WAYPOINT_REACH

export const stepRunningChocobo = (
  scene: Object3D,
  pose: ChocoboPose,
  path: readonly RunOffWaypoint[],
  waypointIndex: number,
): RunningStep => {
  const target = path[waypointIndex]
  const dx = wrapDelta(target.x - pose.x, WORLD_WIDTH_PSX)
  const dz = wrapDelta(target.z - pose.z, WORLD_DEPTH_PSX)
  const heading = calculateOffsetHeading(dx, dz)
  const step = calculateHeadingStep(CHOCOBO_RUN_OFF_SPEED, heading)
  const x = wrapMapX(pose.x + step.x)
  const z = wrapMapZ(pose.z + step.z)
  const triangle = findTopTriangle(scene, x, z)
  return {
    pose: { altitude: calculateGroundAltitude(triangle, pose.altitude), heading, triangle, x, z },
    waypointIndex: isWaypointReached(dx, dz) ? waypointIndex + 1 : waypointIndex,
  }
}
