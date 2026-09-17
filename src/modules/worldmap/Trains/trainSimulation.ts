import {
  TRAIN_ACCELERATION,
  TRAIN_BRAKING_SPEED_PER_POINT,
  TRAIN_BRAKING_WINDOW_POINTS,
  TRAIN_COLLISION_STOP_FRAMES,
  TRAIN_FRAME_STEP,
  TRAIN_HELD_STOP,
  TRAIN_MIN_BRAKING_SPEED,
  TRAIN_PROXIMITY_DISTANCE_SQUARED,
  TRAIN_PROXIMITY_MIN_SPEED,
  TRAIN_PROXIMITY_SPEED_SCALE,
  TRAIN_RESEATING_RAIL,
  TRAIN_START_SPEED,
  TRAIN_STOP_FRAMES,
} from '../../../constants/worldmapTrains'
import {
  advanceCar,
  calculateCarSeatOffset,
  getPointIndex,
  getStationPoints,
  isStationPoint,
  Rail,
  seatCars,
  TrainCar,
  TrainDirection,
  turnCarAround,
} from './trainCars'

export type Train = {
  cars: readonly TrainCar[]
  direction: TrainDirection
  hasFlippingLinks: boolean
  links: readonly number[]
  playerDistanceSquared: number
  previousCars: readonly TrainCar[]
  railIndex: number
  speed: number
  stationsReached: number
  status: TrainStatus
  stopTicks: number
  topSpeed: number
}

export type TrainSpec = {
  carCount: number
  direction: TrainDirection
  hasFlippingLinks: boolean
  links: readonly number[]
  railIndex: number
  topSpeed: number
}

export type TrainStatus = 'atLineEnd' | 'atStation' | 'moving'

export type TrainStep = {
  hasReachedLineEnd: boolean
  train: Train
}

export type TrainStepContext = {
  isRiding: boolean
  isStoryHoldSet: boolean
  isTouchingPlayer: (train: Train) => boolean
  playerRadius: number
}

type SettledTrain = {
  hasCarEvent: boolean
  train: Train
}

export const createTrain = (rail: Rail, spec: TrainSpec): Train => {
  const cars = seatCars(rail, spec.railIndex, spec.direction, spec.carCount)
  return {
    cars,
    direction: spec.direction,
    hasFlippingLinks: spec.hasFlippingLinks,
    links: spec.links,
    playerDistanceSquared: Infinity,
    previousCars: cars,
    railIndex: spec.railIndex,
    speed: 0,
    stationsReached: 0,
    status: 'moving',
    stopTicks: TRAIN_STOP_FRAMES,
    topSpeed: spec.topSpeed,
  }
}

const flipDirection = (direction: TrainDirection): TrainDirection => (direction === 1 ? -1 : 1)

const getLeadCarIndex = (train: Train) => (train.direction === 1 ? 0 : train.cars.length - 1)

// The original measures against the point count in both directions, so a train heading back
// towards point 0 never brakes for the end of the line.
const countPointsToLineEnd = (rail: Rail, direction: TrainDirection, leadPoint: number) =>
  direction === 1 ? rail.points.length - leadPoint : leadPoint - rail.points.length

const countPointsToNextStop = (rail: Rail, train: Train) => {
  const leadPoint = getPointIndex(rail, train.direction, train.cars[getLeadCarIndex(train)].segment)
  const stationDistances = getStationPoints(rail, train.direction).map((station) =>
    train.direction === 1 ? station - leadPoint : leadPoint - station,
  )
  const ahead = [...stationDistances, countPointsToLineEnd(rail, train.direction, leadPoint)].filter(
    (points) => points > 0,
  )
  return Math.min(...ahead)
}

const brakeForNextStop = (rail: Rail, train: Train, speed: number) => {
  const points = countPointsToNextStop(rail, train)
  if (points > TRAIN_BRAKING_WINDOW_POINTS) {
    return speed
  }
  const cap = Math.max(
    TRAIN_MIN_BRAKING_SPEED,
    train.topSpeed + TRAIN_BRAKING_SPEED_PER_POINT * (points - TRAIN_BRAKING_WINDOW_POINTS),
  )
  return Math.min(speed, cap)
}

const slowNearPlayer = (train: Train, speed: number, playerRadius: number) => {
  const radiusSquared = playerRadius * playerRadius
  const excess = Math.max(train.playerDistanceSquared - radiusSquared, 0)
  const scaled = Math.trunc((excess * train.topSpeed) / (TRAIN_PROXIMITY_DISTANCE_SQUARED - radiusSquared))
  const cap = Math.min(TRAIN_PROXIMITY_SPEED_SCALE * scaled, train.topSpeed)
  return speed < TRAIN_PROXIMITY_MIN_SPEED ? TRAIN_PROXIMITY_MIN_SPEED : Math.min(speed, cap)
}

const calculateNextSpeed = (rail: Rail, train: Train, context: TrainStepContext) => {
  const accelerated = (train.speed === 0 ? TRAIN_START_SPEED : train.speed) + TRAIN_ACCELERATION
  const isPlayerFar = train.playerDistanceSquared >= TRAIN_PROXIMITY_DISTANCE_SQUARED
  const adjusted =
    context.isRiding || isPlayerFar
      ? brakeForNextStop(rail, train, accelerated)
      : slowNearPlayer(train, accelerated, context.playerRadius)
  return Math.min(adjusted, train.topSpeed)
}

const pushCars = (rail: Rail, train: Train, context: TrainStepContext): Train => {
  const speed = calculateNextSpeed(rail, train, context)
  const step = (TRAIN_FRAME_STEP * speed) >> 1
  return {
    ...train,
    cars: train.cars.map((car) => ({ ...car, distance: car.distance + step })),
    previousCars: train.cars,
    speed,
  }
}

const countDownStop = (train: Train): Train =>
  train.stopTicks > 0 ? { ...train, stopTicks: train.stopTicks - 1 } : train

const settleCar = (rail: Rail, settled: SettledTrain, carIndex: number): SettledTrain => {
  const { train } = settled
  const canStopAtStation = train.stopTicks === 0 && carIndex === getLeadCarIndex(train)
  const advance = advanceCar(rail, train.direction, train.cars[carIndex], canStopAtStation)
  const cars = train.cars.map((car, index) => (index === carIndex ? advance.car : car))
  const stopped: Train = advance.hasStoppedAtStation
    ? {
        ...train,
        cars,
        speed: 0,
        stationsReached: train.stationsReached + 1,
        status: 'atStation',
        stopTicks: TRAIN_STOP_FRAMES,
      }
    : { ...train, cars }
  const next: Train = advance.hasReachedLineEnd
    ? { ...stopped, stationsReached: stopped.stationsReached + 1, status: 'atLineEnd' }
    : stopped
  return {
    hasCarEvent: settled.hasCarEvent || advance.hasStoppedAtStation || advance.hasReachedLineEnd,
    train: next,
  }
}

const settleCars = (rail: Rail, train: Train) =>
  train.cars.reduce((settled, _, carIndex) => settleCar(rail, settled, carIndex), {
    hasCarEvent: false,
    train: train.stopTicks === 0 ? { ...train, status: 'moving' as const } : train,
  })

const isCarParked = (rail: Rail, direction: TrainDirection, car: TrainCar) =>
  car.distance === 0 && (car.segment === 0 || isStationPoint(rail, direction, car.segment))

const turnTrainAround = (rail: Rail, train: Train): Train => {
  const cars = train.cars.map((car) => turnCarAround(rail, train.direction, car))
  return {
    ...train,
    cars,
    direction: flipDirection(train.direction),
    previousCars: cars,
    stationsReached: getStationPoints(rail, train.direction).length - train.stationsReached,
  }
}

const backAwayFromPlayer = (rail: Rail, train: Train, context: TrainStepContext): Train => {
  if (train.stopTicks !== 0 || !context.isTouchingPlayer(train)) {
    return train
  }
  const restored: Train = {
    ...train,
    cars: train.previousCars.map((car) => advanceCar(rail, train.direction, car, false).car),
    speed: 0,
    stopTicks: TRAIN_COLLISION_STOP_FRAMES,
  }
  const isParked = restored.cars.some((car) => isCarParked(rail, restored.direction, car))
  return context.isStoryHoldSet || isParked ? restored : turnTrainAround(rail, restored)
}

const compareCarProgress = (a: TrainCar, b: TrainCar) => a.segment - b.segment || a.distance - b.distance

const reseatBehindLeader = (rail: Rail, train: Train): Train => {
  const leader = train.cars.reduce((best, car) => (compareCarProgress(car, best) > 0 ? car : best))
  const cars = train.cars.map(
    (car, carIndex) =>
      advanceCar(
        rail,
        train.direction,
        {
          ...car,
          distance: calculateCarSeatOffset(train.railIndex, train.direction, carIndex, train.cars.length),
          segment: leader.segment,
        },
        false,
      ).car,
  )
  return { ...train, cars, previousCars: cars }
}

const reseatAtStation = (rail: Rail, { hasCarEvent, train }: SettledTrain): Train =>
  hasCarEvent && train.status === 'atStation' && train.stopTicks > 0 && train.railIndex === TRAIN_RESEATING_RAIL
    ? reseatBehindLeader(rail, train)
    : train

const restartFromLineEnd = (rail: Rail, train: Train, context: TrainStepContext): Train => {
  const direction = flipDirection(train.direction)
  const cars = seatCars(rail, train.railIndex, direction, train.cars.length)
  return {
    ...train,
    cars,
    direction,
    links: train.hasFlippingLinks ? train.links.map((link) => -link) : train.links,
    previousCars: cars,
    speed: 0,
    stationsReached: 0,
    stopTicks: context.isStoryHoldSet ? TRAIN_HELD_STOP : TRAIN_STOP_FRAMES,
  }
}

export const stepTrain = (rail: Rail, train: Train, context: TrainStepContext): TrainStep => {
  const counted = countDownStop(train)
  const pushed = counted.stopTicks === 0 ? pushCars(rail, counted, context) : counted
  const settled = settleCars(rail, pushed)
  const checked = backAwayFromPlayer(rail, settled.train, context)
  const reseated = reseatAtStation(rail, { hasCarEvent: settled.hasCarEvent, train: checked })
  if (reseated.stopTicks !== 0 || reseated.status !== 'atLineEnd') {
    return { hasReachedLineEnd: false, train: reseated }
  }
  return { hasReachedLineEnd: true, train: restartFromLineEnd(rail, reseated, context) }
}
