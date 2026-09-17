import { Object3D } from 'three'

import { CHARACTER_FOOTPRINT } from '../../../../constants/worldmapEntities'
import {
  CHOCOBO_ACCESS_BIT,
  CHOCOBO_PATH_HEADING_STEP,
  CHOCOBO_PATH_HEADING_TRIES,
  CHOCOBO_PATH_MAX_LENGTH,
  CHOCOBO_PATH_PROBE_DISTANCE,
  CHOCOBO_PATH_STEPS_PER_TICK,
  CHOCOBO_RUN_OFF_START_FRAME,
} from '../../../../constants/worldmapVehicles'
import { findCollidingEntity } from '../../Entities/entityCollision'
import { getAllEntities, WORLDMAP_STATE } from '../../Scripts/state'
import { hasAccessBit, TerrainFace, TerrainPoint } from '../../terrain'
import { PARTY_ENTITY_SLOT, SLIDE_PROBE_OFFSET_PSX } from '../constants'
import { buildCollisionBox } from '../disembarkUtils'
import { calculateHeadingStep } from '../drivingUtils'
import { calculateOffsetHeading, shortestPsxDelta, wrapPsxAngle } from '../playerAngles'
import { findTopFace, wrapMapX, wrapMapZ } from '../shipPose'

export type RunOffSearch = {
  attempt: number
  bestPath: readonly RunOffWaypoint[] | undefined
  exits: readonly RunOffWaypoint[]
  faces: readonly TerrainFace[]
  heading: number
  isRetryingSecondEdge: boolean
  length: number
  startHeading: number
}

export type RunOffSearchOutcome = {
  isFinished: boolean
  search: RunOffSearch
}

export type RunOffWaypoint = {
  altitude: number
  x: number
  z: number
}

type FaceEdge = {
  midpoint: RunOffWaypoint
  offsetHeading: number
}

const replaceAt = <T>(items: readonly T[], index: number, item: T) => [
  ...items.slice(0, index),
  item,
  ...items.slice(index + 1),
]

const averagePoints = (points: readonly TerrainPoint[]): RunOffWaypoint => ({
  altitude: points.reduce((sum, point) => sum + point.altitude, 0) / points.length,
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
})

const buildFaceEdges = ({ vertices }: TerrainFace): readonly FaceEdge[] => {
  const centroid = averagePoints(vertices)
  return vertices.map((vertex, index) => {
    const midpoint = averagePoints([vertex, vertices[(index + 1) % vertices.length]])
    return { midpoint, offsetHeading: calculateOffsetHeading(midpoint.x - centroid.x, midpoint.z - centroid.z) }
  })
}

const rankEdgesByHeading = (edges: readonly FaceEdge[], heading: number) =>
  [...edges].sort(
    (first, second) =>
      Math.abs(shortestPsxDelta(heading, first.offsetHeading)) -
      Math.abs(shortestPsxDelta(heading, second.offsetHeading)),
  )

const wrapWaypoint = (waypoint: RunOffWaypoint): RunOffWaypoint => ({
  ...waypoint,
  x: wrapMapX(waypoint.x),
  z: wrapMapZ(waypoint.z),
})

const getBestLength = (search: RunOffSearch) => search.bestPath?.length ?? -1

const buildProbe = (exit: RunOffWaypoint, heading: number): RunOffWaypoint => {
  const step = calculateHeadingStep(CHOCOBO_PATH_PROBE_DISTANCE, heading)
  return { altitude: exit.altitude, x: wrapMapX(exit.x + step.x), z: wrapMapZ(exit.z + step.z) }
}

const isProbeOccupied = (probe: RunOffWaypoint) =>
  findCollidingEntity(getAllEntities(), {
    box: buildCollisionBox(probe, SLIDE_PROBE_OFFSET_PSX, CHARACTER_FOOTPRINT.height),
    excludedIndices: [WORLDMAP_STATE.reservedSlots[PARTY_ENTITY_SLOT]],
    isHeightIgnored: false,
    reach: 0,
  }) >= 0

const isDeadEnd = (face: TerrainFace, nextFace: TerrainFace, probe: RunOffWaypoint) =>
  !hasAccessBit(nextFace.triangle, CHOCOBO_ACCESS_BIT) || isProbeOccupied(probe) || nextFace.key === face.key

const finishSearch = (search: RunOffSearch): RunOffSearchOutcome => ({ isFinished: true, search })

const endTick = (search: RunOffSearch): RunOffSearchOutcome => ({ isFinished: false, search })

const startNextAttempt = (search: RunOffSearch) =>
  endTick({ ...search, attempt: search.attempt + 1, isRetryingSecondEdge: false, length: 0 })

export const createRunOffSearch = (face: TerrainFace, startHeading: number): RunOffSearch => ({
  attempt: 0,
  bestPath: undefined,
  exits: [],
  faces: [face],
  heading: startHeading,
  isRetryingSecondEdge: false,
  length: 0,
  startHeading,
})

const beginAttempt = (search: RunOffSearch): RunOffSearch =>
  search.length === 0
    ? {
        ...search,
        heading: wrapPsxAngle(search.startHeading + search.attempt * CHOCOBO_PATH_HEADING_STEP),
        isRetryingSecondEdge: false,
      }
    : search

const continueSearch = (scene: Object3D, search: RunOffSearch, iteration: number): RunOffSearchOutcome =>
  iteration + 1 >= CHOCOBO_PATH_STEPS_PER_TICK ? endTick(search) : runSearchIteration(scene, search, iteration + 1)

// After the second-best edge also fails, the original keeps its first step and carries on from step 1.
const keepLongestAndRestart = (scene: Object3D, search: RunOffSearch, iteration: number) => {
  if (getBestLength(search) >= search.length) {
    return startNextAttempt(search)
  }
  const restarted = {
    ...search,
    attempt: search.attempt + 1,
    bestPath: search.exits.slice(0, search.length),
    isRetryingSecondEdge: false,
    length: 1,
  }
  return continueSearch(scene, restarted, iteration)
}

const retrySecondEdge = (scene: Object3D, search: RunOffSearch, edges: readonly FaceEdge[], iteration: number) => {
  if (search.length <= 0) {
    return startNextAttempt(search)
  }
  const secondEdge = rankEdgesByHeading(edges, search.heading)[1]
  return continueSearch(scene, { ...search, heading: secondEdge.offsetHeading, isRetryingSecondEdge: true }, iteration)
}

const handleDeadEnd = (scene: Object3D, search: RunOffSearch, edges: readonly FaceEdge[], iteration: number) => {
  if (search.attempt >= CHOCOBO_PATH_HEADING_TRIES) {
    return finishSearch(search)
  }
  return search.isRetryingSecondEdge
    ? keepLongestAndRestart(scene, search, iteration)
    : retrySecondEdge(scene, search, edges, iteration)
}

const advanceOntoFace = (scene: Object3D, search: RunOffSearch, nextFace: TerrainFace, iteration: number) => {
  const advanced = {
    ...search,
    bestPath: getBestLength(search) < search.length ? search.exits.slice(0, search.length) : search.bestPath,
    faces: replaceAt(search.faces, search.length + 1, nextFace),
    isRetryingSecondEdge: false,
  }
  if (search.length >= CHOCOBO_PATH_MAX_LENGTH) {
    return finishSearch(advanced)
  }
  return continueSearch(scene, { ...advanced, length: search.length + 1 }, iteration)
}

const runSearchIteration = (scene: Object3D, search: RunOffSearch, iteration: number): RunOffSearchOutcome => {
  const face = search.faces[search.length]
  if (!face) {
    return finishSearch(search)
  }
  const edges = buildFaceEdges(face)
  const exit = wrapWaypoint(rankEdgesByHeading(edges, search.heading)[0].midpoint)
  const withExit = { ...search, exits: replaceAt(search.exits, search.length, exit) }
  const probe = buildProbe(exit, search.heading)
  const nextFace = findTopFace(scene, probe.x, probe.z)
  if (!nextFace) {
    return endTick(withExit)
  }
  if (isDeadEnd(face, nextFace, probe)) {
    return handleDeadEnd(scene, withExit, edges, iteration)
  }
  return advanceOntoFace(scene, withExit, nextFace, iteration)
}

export const advanceRunOffSearch = (scene: Object3D, search: RunOffSearch, dismountFrame: number) => {
  const prepared = beginAttempt(search)
  if (dismountFrame >= CHOCOBO_RUN_OFF_START_FRAME) {
    return finishSearch(prepared)
  }
  return runSearchIteration(scene, prepared, 0)
}
