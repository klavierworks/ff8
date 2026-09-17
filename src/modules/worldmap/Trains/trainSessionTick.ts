import { TRAIN_COLLISION_OFF_STATE } from '../../../constants/worldmapTrains'
import useGlobalStore from '../../../store'
import { getEntityFootprintRadius } from '../Entities/entityCollision'
import { isTrainClass } from '../vehicleClasses'
import { getVehicleEntityType } from '../vehicleEntities'
import { leaveWorldmapToField } from '../worldmapExit'
import useWorldmapStore, {
  WORLD_MAP_STATE_BOAT_RIDE,
  WORLD_MAP_STATE_RIDING_TRAIN_0,
  WORLD_MAP_STATE_RIDING_TRAIN_1,
  WORLD_MAP_STATE_SCRIPTED_TRAIN_RIDE,
} from '../worldmapStore'
import { calculateHeldCameraFrame } from './rideCamera'
import {
  buildPlayerProbe,
  calculatePlayerDistanceSquared,
  getProbeOffset,
  isTrainTouchingProbe,
  PlayerProbe,
} from './trainCollision'
import { setWorldFromRailPoint } from './trainPlacement'
import {
  findRiddenCar,
  findRiddenTrain,
  getRail,
  getRiddenTrainSlot,
  isRidingFreeRoamTrain,
  isRidingState,
  isStoryHoldSet,
} from './trainRide'
import { getTrainSession, setTrainSession, TrainSession } from './trainSession'
import { stepTrain, Train, TrainStepContext } from './trainSimulation'
import { findLineEndExit, isCameraHeldAtStation } from './trainStops'

const isTouchablePlayer = (worldMapState: number, vehicleId: number) =>
  !isTrainClass(vehicleId) &&
  worldMapState !== WORLD_MAP_STATE_BOAT_RIDE &&
  worldMapState !== WORLD_MAP_STATE_SCRIPTED_TRAIN_RIDE &&
  worldMapState !== TRAIN_COLLISION_OFF_STATE

const readPlayerProbe = (vehicleId: number) => {
  const position = useGlobalStore.getState().characterPosition
  return position ? buildPlayerProbe(position, getProbeOffset(vehicleId)) : undefined
}

const buildStepContext = (
  session: TrainSession,
  worldMapState: number,
  vehicleId: number,
  probe: PlayerProbe | undefined,
): TrainStepContext => ({
  isRiding: isRidingState(worldMapState),
  isStoryHoldSet: isStoryHoldSet(),
  isTouchingPlayer: (train) =>
    probe !== undefined && isTouchablePlayer(worldMapState, vehicleId) && isTrainTouchingProbe(session, train, probe),
  playerRadius: getEntityFootprintRadius(getVehicleEntityType(vehicleId)),
})

const measurePlayerDistance = (train: Train, probe: PlayerProbe | undefined): Train => ({
  ...train,
  playerDistanceSquared: probe ? calculatePlayerDistanceSquared(train, probe) : Infinity,
})

const advanceCameraFrame = (session: TrainSession, worldMapState: number) => {
  const train = findRiddenTrain(session, worldMapState)
  const isHeld =
    session.cameraTrack !== undefined &&
    train !== undefined &&
    isRidingFreeRoamTrain(worldMapState) &&
    isCameraHeldAtStation(train)
  const frame =
    isHeld && session.cameraTrack
      ? calculateHeldCameraFrame(session.cameraTrack, session.cameraFrame)
      : session.cameraFrame
  return frame + 1
}

const findRideExit = (session: TrainSession, worldMapState: number, lineEnds: readonly boolean[]) => {
  if (worldMapState === WORLD_MAP_STATE_BOAT_RIDE || worldMapState === WORLD_MAP_STATE_SCRIPTED_TRAIN_RIDE) {
    return lineEnds.some(Boolean) ? session.rideDestinationEntrance : undefined
  }
  if (worldMapState !== WORLD_MAP_STATE_RIDING_TRAIN_0 && worldMapState !== WORLD_MAP_STATE_RIDING_TRAIN_1) {
    return undefined
  }
  const slot = getRiddenTrainSlot(worldMapState)
  const train = session.trains[slot]
  return lineEnds[slot] && train ? findLineEndExit(train) : undefined
}

const placeRider = (session: TrainSession, worldMapState: number) => {
  const position = useGlobalStore.getState().characterPosition
  const car = findRiddenCar(session, worldMapState)
  if (position && car) {
    setWorldFromRailPoint(position, car)
  }
}

export const runTrainSessionTick = () => {
  const session = getTrainSession()
  const { isExiting, vehicleId, worldMapState } = useWorldmapStore.getState()
  if (!session || isExiting) {
    return
  }
  const probe = readPlayerProbe(vehicleId)
  const context = buildStepContext(session, worldMapState, vehicleId, probe)
  const steps = session.trains.map((train) => train && stepTrain(getRail(train.railIndex), train, context))
  const next: TrainSession = {
    ...session,
    cameraFrame: advanceCameraFrame(session, worldMapState),
    trains: steps.map((step) => step && measurePlayerDistance(step.train, probe)),
  }
  setTrainSession(next)
  placeRider(next, worldMapState)
  const exit = findRideExit(
    next,
    worldMapState,
    steps.map((step) => step?.hasReachedLineEnd === true),
  )
  if (exit !== undefined) {
    leaveWorldmapToField(exit)
  }
}
