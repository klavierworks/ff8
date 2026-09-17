import {
  TRAIN_ENGINE_AUDIBLE_DISTANCE_SQUARED,
  TRAIN_ENGINE_DISTANCE_SHIFT,
  TRAIN_ENGINE_MAX_VOLUME,
  TRAIN_ENGINE_SOUND_ID,
  TRAIN_ENGINE_SPEED_SHIFT,
} from '../../../constants/worldmapTrains'
import useLoopingWorldSound from '../useLoopingWorldSound'
import { getTrainSession, TrainSession } from './trainSession'
import { Train } from './trainSimulation'

const findNearestTrain = (session: TrainSession) =>
  session.trains.reduce<Train | undefined>(
    (nearest, train) =>
      train && (!nearest || train.playerDistanceSquared < nearest.playerDistanceSquared) ? train : nearest,
    undefined,
  )

const calculateEngineVolume = (session: null | TrainSession) => {
  const train = session ? findNearestTrain(session) : undefined
  if (!train || train.playerDistanceSquared >= TRAIN_ENGINE_AUDIBLE_DISTANCE_SQUARED) {
    return 0
  }
  const closeness = Math.floor(Math.sqrt(TRAIN_ENGINE_AUDIBLE_DISTANCE_SQUARED - train.playerDistanceSquared))
  const volume =
    (closeness >> TRAIN_ENGINE_DISTANCE_SHIFT) - ((train.topSpeed - train.speed) >> TRAIN_ENGINE_SPEED_SHIFT)
  return Math.min(Math.max(volume, 0), TRAIN_ENGINE_MAX_VOLUME)
}

const getEngineVolume = () => calculateEngineVolume(getTrainSession())

const useTrainEngineSound = (hasTrains: boolean) => {
  useLoopingWorldSound(hasTrains ? TRAIN_ENGINE_SOUND_ID : undefined, getEngineVolume)
}

export default useTrainEngineSound
