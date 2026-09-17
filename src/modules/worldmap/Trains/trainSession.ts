import { RideCameraTrack } from './rideCamera'
import { Train } from './trainSimulation'

export type TrainSession = {
  cameraFrame: number
  cameraTrack: RideCameraTrack | undefined
  rideDestinationEntrance: number
  riderRestoreVehicleId: number
  rideVehicleTypeCode: number | undefined
  trains: readonly (Train | undefined)[]
}

let session: null | TrainSession = null

export const getTrainSession = () => session

export const setTrainSession = (next: null | TrainSession) => {
  session = next
}

export const updateTrainSession = (update: (current: TrainSession) => TrainSession) => {
  if (session) {
    session = update(session)
  }
}

export const resetTrainSession = () => {
  session = null
}
