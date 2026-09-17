import type { WorldmapRails } from '@data/types/worldmap/WorldmapRails'

import { FIRST_WMSET_ENTITY_TYPE, WMSET_ENTITY_FOOTPRINTS } from '../../../constants/worldmapEntities'
import {
  TRAIN_CAR_GAP,
  TRAIN_CAR_LENGTH_TRIM,
  TRAIN_CAR_TYPES_BY_RAIL,
  TRAIN_SEGMENT_FRACTION_SHIFT,
} from '../../../constants/worldmapTrains'

export type CarAdvance = {
  car: TrainCar
  hasReachedLineEnd: boolean
  hasStoppedAtStation: boolean
}

export type Rail = WorldmapRails[number]
export type RailPoint = Rail['points'][number]

export type TrainCar = {
  altitude: number
  distance: number
  segment: number
  x: number
  z: number
}

export type TrainDirection = -1 | 1

const toInt16 = (value: number) => (value << 16) >> 16

export const getPointIndex = (rail: Rail, direction: TrainDirection, segment: number) =>
  direction === 1 ? segment : rail.points.length - segment - 1

export const getStationPoints = (rail: Rail, direction: TrainDirection) =>
  direction === 1 ? rail.stations_forward : rail.stations_backward

const getLastSegment = (rail: Rail) => rail.points.length - 1

const getSegmentEnds = (rail: Rail, direction: TrainDirection, segment: number) => {
  const index = getPointIndex(rail, direction, segment)
  return { from: rail.points[index], to: rail.points[index + direction] }
}

const calculateSegmentLength = (from: RailPoint | undefined, to: RailPoint | undefined) =>
  from && to
    ? Math.floor(Math.hypot(toInt16(to.x - from.x), toInt16(to.altitude - from.altitude), toInt16(to.z - from.z)))
    : 0

const interpolateAxis = (from: number, to: number, fraction: number, length: number) =>
  length === 0 ? from : from + Math.trunc((fraction * (to - from)) / length)

const placeCar = (rail: Rail, direction: TrainDirection, car: TrainCar): TrainCar => {
  const { from, to } = getSegmentEnds(rail, direction, car.segment)
  const length = calculateSegmentLength(from, to) >> TRAIN_SEGMENT_FRACTION_SHIFT
  const fraction = car.distance >> TRAIN_SEGMENT_FRACTION_SHIFT
  return {
    ...car,
    altitude: interpolateAxis(from.altitude, to.altitude, fraction, length),
    x: interpolateAxis(from.x, to.x, fraction, length),
    z: interpolateAxis(from.z, to.z, fraction, length),
  }
}

export const isStationPoint = (rail: Rail, direction: TrainDirection, segment: number) =>
  getStationPoints(rail, direction).includes(getPointIndex(rail, direction, segment))

export const advanceCar = (
  rail: Rail,
  direction: TrainDirection,
  car: TrainCar,
  canStopAtStation: boolean,
): CarAdvance => {
  let { distance, segment } = car
  let hasStoppedAtStation = false
  while (segment < getLastSegment(rail)) {
    const { from, to } = getSegmentEnds(rail, direction, segment)
    const length = calculateSegmentLength(from, to)
    if (distance < length) {
      return {
        car: placeCar(rail, direction, { ...car, distance, segment }),
        hasReachedLineEnd: false,
        hasStoppedAtStation,
      }
    }
    segment += 1
    distance -= length
    if (canStopAtStation && !hasStoppedAtStation && isStationPoint(rail, direction, segment)) {
      hasStoppedAtStation = true
    }
  }
  return { car: { ...car, distance, segment }, hasReachedLineEnd: true, hasStoppedAtStation }
}

export const turnCarAround = (rail: Rail, direction: TrainDirection, car: TrainCar): TrainCar => {
  const { from, to } = getSegmentEnds(rail, direction, car.segment)
  return {
    ...car,
    distance: calculateSegmentLength(from, to) - car.distance,
    segment: rail.points.length - car.segment - 2,
  }
}

export const getCarFootprint = (typeCode: number) => WMSET_ENTITY_FOOTPRINTS[typeCode - FIRST_WMSET_ENTITY_TYPE]

const getCarGap = (typeCode: number) => (getCarFootprint(typeCode)?.width ?? 0) - TRAIN_CAR_LENGTH_TRIM

const calculateSeatOffset = (railIndex: number, seatsFromRear: number) => {
  const types = TRAIN_CAR_TYPES_BY_RAIL[railIndex]
  if (!types) {
    return 0
  }
  const endGap = getCarGap(types.end)
  const middleGap = getCarGap(types.middle)
  const steps = [0, endGap + TRAIN_CAR_GAP, middleGap, middleGap + TRAIN_CAR_GAP, endGap + TRAIN_CAR_GAP]
  return steps.slice(0, seatsFromRear + 1).reduce((sum, step) => sum + step, 0)
}

const countSeatsFromRear = (direction: TrainDirection, carIndex: number, carCount: number) =>
  direction === -1 ? carIndex : carCount - carIndex - 1

export const calculateCarSeatOffset = (
  railIndex: number,
  direction: TrainDirection,
  carIndex: number,
  carCount: number,
) => calculateSeatOffset(railIndex, countSeatsFromRear(direction, carIndex, carCount))

const createSeatedCar = (
  railIndex: number,
  direction: TrainDirection,
  carIndex: number,
  carCount: number,
): TrainCar => ({
  altitude: 0,
  distance: calculateCarSeatOffset(railIndex, direction, carIndex, carCount),
  segment: 0,
  x: 0,
  z: 0,
})

export const seatCars = (rail: Rail, railIndex: number, direction: TrainDirection, carCount: number) =>
  Array.from(
    { length: carCount },
    (_, carIndex) => advanceCar(rail, direction, createSeatedCar(railIndex, direction, carIndex, carCount), false).car,
  )

export const getRailCarTypeCode = (railIndex: number, carIndex: number) => {
  const types = TRAIN_CAR_TYPES_BY_RAIL[railIndex]
  if (!types) {
    return undefined
  }
  return carIndex === 1 || carIndex === 3 ? types.middle : types.end
}
