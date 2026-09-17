import { Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../constants/vehicles'
import { FOOTPRINT_SHAPE_NONE, FOOTPRINT_SHAPE_WIDE } from '../../../constants/worldmapEntities'
import { TRAIN_COLLISION_REACH_SQUARED, TRAIN_RAGNAROK_PROBE_OFFSET_PSX } from '../../../constants/worldmapTrains'
import { VEHICLE_PROBE_OFFSET_PSX } from '../../../constants/worldmapVehicles'
import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX } from '../constants'
import { wrapDelta } from '../Entities/entityCollision'
import { SLIDE_PROBE_OFFSET_PSX } from '../Player/constants'
import { worldXToPsx, worldZToPsx } from '../Player/playerUtils'
import { worldYToPsxHeight } from '../terrain'
import { isCarOrGarden, isRagnarok, isTrainClass } from '../vehicleClasses'
import useWorldmapStore from '../worldmapStore'
import { getCarFootprint, TrainCar } from './trainCars'
import { getDrawnCarTypeCode } from './trainRide'
import { getTrainSession, TrainSession } from './trainSession'
import { Train } from './trainSimulation'

export type PlayerProbe = {
  altitude: number
  offset: number
  x: number
  y: number
}

const _stepPosition = new Vector3()

type PlanarPoint = {
  x: number
  y: number
}

const getCarPlanarDelta = (car: TrainCar, point: PlanarPoint): PlanarPoint => ({
  x: wrapDelta(point.x - car.x, WORLD_WIDTH_PSX),
  y: wrapDelta(point.y + car.z, WORLD_DEPTH_PSX),
})

export const getProbeOffset = (vehicleId: number) => {
  if (isRagnarok(vehicleId)) {
    return TRAIN_RAGNAROK_PROBE_OFFSET_PSX
  }
  return isCarOrGarden(vehicleId) ? VEHICLE_PROBE_OFFSET_PSX : SLIDE_PROBE_OFFSET_PSX
}

export const buildPlayerProbe = (position: Vector3, offset: number): PlayerProbe => ({
  altitude: worldYToPsxHeight(position.y),
  offset,
  x: worldXToPsx(position.x),
  y: worldZToPsx(position.z),
})

const getProbePoints = ({ offset, x, y }: PlayerProbe): readonly PlanarPoint[] => [
  { x, y },
  { x: x - offset, y },
  { x, y: y - offset },
  { x: x + offset, y },
  { x, y: y + offset },
]

const buildCarQuad = (car: TrainCar, neighbour: TrainCar, length: number, halfWidth: number, isWide: boolean) => {
  const toNeighbour = getCarPlanarDelta(car, { x: neighbour.x, y: -neighbour.z })
  const span = Math.hypot(toNeighbour.x, toNeighbour.y) || 1
  const forward = { x: toNeighbour.x / span, y: toNeighbour.y / span }
  const side = { x: -forward.y, y: forward.x }
  const near = isWide ? 0 : -length / 2
  const far = isWide ? length : length / 2
  return [
    [near, halfWidth],
    [far, halfWidth],
    [far, -halfWidth],
    [near, -halfWidth],
  ].map(([along, across]) => ({
    x: forward.x * along + side.x * across,
    y: forward.y * along + side.y * across,
  }))
}

const calculateCross = (a: PlanarPoint, b: PlanarPoint, point: PlanarPoint) =>
  (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)

const isPointInQuad = (quad: readonly PlanarPoint[], point: PlanarPoint) => {
  const crosses = quad.map((corner, index) => calculateCross(corner, quad[(index + 1) % quad.length], point))
  return crosses.every((cross) => cross >= 0) || crosses.every((cross) => cross <= 0)
}

const isPointInProbeBox = (probe: PlanarPoint, offset: number, point: PlanarPoint) =>
  Math.abs(point.x - probe.x) <= offset && Math.abs(point.y - probe.y) <= offset

const isCarTouchingProbe = (session: TrainSession, train: Train, carIndex: number, probe: PlayerProbe) => {
  const car = train.cars[carIndex]
  const link = train.links[carIndex] ?? 0
  const neighbour = train.cars[carIndex + link]
  const typeCode = getDrawnCarTypeCode(session, train, carIndex)
  const footprint = typeCode === undefined ? undefined : getCarFootprint(typeCode)
  if (!car || !neighbour || link === 0 || !footprint || footprint.shape === FOOTPRINT_SHAPE_NONE) {
    return false
  }
  if (probe.altitude < Math.min(car.altitude, neighbour.altitude) - footprint.height) {
    return false
  }
  const centre = getCarPlanarDelta(car, probe)
  if (centre.x * centre.x + centre.y * centre.y >= TRAIN_COLLISION_REACH_SQUARED) {
    return false
  }
  const quad = buildCarQuad(
    car,
    neighbour,
    footprint.width,
    footprint.depth / 2,
    footprint.shape === FOOTPRINT_SHAPE_WIDE,
  )
  const probePoints = getProbePoints({ ...probe, ...centre })
  return (
    probePoints.some((point) => isPointInQuad(quad, point)) ||
    quad.some((corner) => isPointInProbeBox(centre, probe.offset, corner))
  )
}

export const isTrainTouchingProbe = (session: TrainSession, train: Train, probe: PlayerProbe) =>
  train.cars.some((_, carIndex) => isCarTouchingProbe(session, train, carIndex, probe))

export const calculatePlayerDistanceSquared = (train: Train, probe: PlayerProbe) =>
  train.cars.reduce((nearest, car) => {
    const delta = getCarPlanarDelta(car, probe)
    const altitude = probe.altitude - car.altitude
    return Math.min(nearest, delta.x * delta.x + delta.y * delta.y + altitude * altitude)
  }, Infinity)

export const isStepBlockedByTrain = (worldX: number, worldY: number, worldZ: number) => {
  const session = getTrainSession()
  const { vehicleId } = useWorldmapStore.getState()
  if (!session || isTrainClass(vehicleId) || vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    return false
  }
  const probe = buildPlayerProbe(_stepPosition.set(worldX, worldY, worldZ), getProbeOffset(vehicleId))
  return session.trains.some((train) => train !== undefined && isTrainTouchingProbe(session, train, probe))
}
