import {
  TRAIN_LAST_STATION_OF_RAIL_0,
  TRAIN_RAIL_0_FORWARD_EXIT,
  TRAIN_RAIL_1_BACKWARD_EXIT,
  TRAIN_RAIL_1_FORWARD_EXIT,
  TRAIN_STATION_OF_RAIL_1,
} from '../../../constants/worldmapTrains'
import { Train } from './trainSimulation'

const NO_STATION = -1

export const isTrainStopped = (train: Train) => train.status === 'atStation' || train.status === 'atLineEnd'

const findRail0Station = (train: Train) => {
  if (train.stationsReached === 1) {
    return 0
  }
  return train.direction === -1 && train.stationsReached === 0 ? TRAIN_LAST_STATION_OF_RAIL_0 : NO_STATION
}

export const getStandingStation = (train: Train) => {
  if (!isTrainStopped(train)) {
    return NO_STATION
  }
  if (train.railIndex === 0) {
    return findRail0Station(train)
  }
  return train.railIndex === 1 && train.stationsReached === 1 ? TRAIN_STATION_OF_RAIL_1 : NO_STATION
}

export const isCameraHeldAtStation = (train: Train) => {
  const station = getStandingStation(train)
  return station >= 0 && station !== TRAIN_LAST_STATION_OF_RAIL_0
}

export const findLineEndExit = (train: Train) => {
  if (train.railIndex === 0) {
    return train.direction === 1 ? TRAIN_RAIL_0_FORWARD_EXIT : undefined
  }
  if (train.railIndex === 1) {
    return train.direction === 1 ? TRAIN_RAIL_1_FORWARD_EXIT : TRAIN_RAIL_1_BACKWARD_EXIT
  }
  return undefined
}
