import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { Vector3 } from 'three'

import {
  TRAIN_BOARDING_CAMERA_GROUPS,
  TRAIN_BOUND_FOR_FIRST_MESSAGE,
  TRAIN_DIALOG_SLOT,
  TRAIN_FARE,
  TRAIN_GET_OFF_MESSAGES,
  TRAIN_GIL_ADDRESS,
  TRAIN_HELD_STOP,
  TRAIN_LAST_STATION_OF_RAIL_0,
  TRAIN_NO_GIL_DIALOG_SLOT,
  TRAIN_NO_GIL_MESSAGE,
  TRAIN_RIDDEN_CAR_INDEX,
  TRAIN_RIDE_VEHICLE,
  TRAIN_STATION_EXIT_VEHICLE,
  TRAIN_STATION_LANDING_MIN,
  TRAIN_STATION_OF_RAIL_1,
} from '../../../constants/worldmapTrains'
import useGlobalStore from '../../../store'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { convertHeadingToFieldDirection } from '../Player/playerAngles'
import { psxXToWorld, psxZToWorld } from '../Player/playerUtils'
import { EVENT_CHOICE_OPTIONS } from '../Scripts/constants'
import { closeDialog, getSlotState, showDialog } from '../Scripts/dialog'
import { ScriptSection } from '../Scripts/runScript'
import { runLocationScripts } from '../Scripts/sectionRunners'
import { psxHeightToWorldY } from '../terrain'
import { WorldPosition } from '../types'
import { isOnFootClass, isTrainClass } from '../vehicleClasses'
import useWorldmapStore, {
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_HELD_PROMPT,
  WORLD_MAP_STATE_RIDING_TRAIN_0,
} from '../worldmapStore'
import { setWorldFromRailPoint } from './trainPlacement'
import {
  getRiddenTrainSlot,
  isRidingFreeRoamTrain,
  isStoryHoldSet,
  pickCameraTrack,
  RideCameraGroups,
} from './trainRide'
import { getTrainSession, TrainSession, updateTrainSession } from './trainSession'
import { Train } from './trainSimulation'
import { getStandingStation, isTrainStopped } from './trainStops'

export type TrainExitPosition = WorldmapSections['section_12_train_exit_positions']['positions'][number]

export type TrainStations = {
  cameraGroups: RideCameraGroups
  exits: readonly TrainExitPosition[]
  scripts: ScriptSection
}

const setTrainStopTicks = (slot: number, stopTicks: number) => {
  updateTrainSession((session) => ({
    ...session,
    trains: session.trains.map((train, index) => (index === slot && train ? { ...train, stopTicks } : train)),
  }))
}

const readChoice = () => {
  const choice = getSlotState(TRAIN_DIALOG_SLOT)
  if (choice >= 0) {
    closeDialog(TRAIN_DIALOG_SLOT)
  }
  return choice
}

const promptOnce = (slot: number, train: Train, messageId: number) => {
  if (train.stopTicks <= 0 || !isTrainStopped(train)) {
    return false
  }
  showDialog(TRAIN_DIALOG_SLOT, messageId, EVENT_CHOICE_OPTIONS)
  setTrainStopTicks(slot, TRAIN_HELD_STOP)
  return true
}

const leaveTrain = (stations: TrainStations, station: number) => {
  const exit = stations.exits[station]
  const session = getTrainSession()
  if (!exit || !session) {
    return
  }
  updateTrainSession((current) => ({ ...current, cameraFrame: 0, cameraTrack: undefined }))
  useWorldmapStore.setState({ vehicleId: session.riderRestoreVehicleId, worldMapState: WORLD_MAP_STATE_FREE_ROAM })
  useGlobalStore.setState({
    characterPosition: new Vector3(psxXToWorld(exit.x), psxHeightToWorldY(exit.z), psxZToWorld(exit.y)),
    fieldDirection: convertHeadingToFieldDirection(0),
  })
}

const runRideStop = (stations: TrainStations, session: TrainSession, worldMapState: number) => {
  const slot = getRiddenTrainSlot(worldMapState)
  const train = session.trains[slot]
  const station = train ? getStandingStation(train) : -1
  if (!train || station < 0) {
    return
  }
  if (isStoryHoldSet() && station === TRAIN_LAST_STATION_OF_RAIL_0) {
    leaveTrain(stations, station)
    return
  }
  if (promptOnce(slot, train, TRAIN_GET_OFF_MESSAGES[station] ?? TRAIN_GET_OFF_MESSAGES[0])) {
    return
  }
  const choice = readChoice()
  if (choice < 0) {
    return
  }
  if (choice === 0) {
    leaveTrain(stations, station)
  }
  setTrainStopTicks(slot, 0)
}

const getBoundForMessage = (station: number, train: Train) => {
  if (station === TRAIN_LAST_STATION_OF_RAIL_0) {
    return TRAIN_BOUND_FOR_FIRST_MESSAGE
  }
  const isForward = train.direction !== -1
  const offset = station === TRAIN_STATION_OF_RAIL_1 ? 2 : 1
  return TRAIN_BOUND_FOR_FIRST_MESSAGE + (isForward ? offset : 0)
}

const getBoardingLanding = (station: number, train: Train) => {
  const isBackward = train.direction === -1
  if (station === TRAIN_STATION_OF_RAIL_1) {
    return TRAIN_STATION_LANDING_MIN + (isBackward ? 3 : 2)
  }
  return TRAIN_STATION_LANDING_MIN + (station === TRAIN_LAST_STATION_OF_RAIL_0 || isBackward ? 1 : 0)
}

const findStationTrainSlot = (session: TrainSession, station: number) =>
  session.trains.findIndex((train) => train !== undefined && getStandingStation(train) === station)

const setWorldMapState = (worldMapState: number) => useWorldmapStore.setState({ worldMapState })

const boardTrain = (stations: TrainStations, slot: number, train: Train, station: number) => {
  MEMORY[TRAIN_GIL_ADDRESS] = (MEMORY[TRAIN_GIL_ADDRESS] ?? 0) - TRAIN_FARE
  const { vehicleId } = useWorldmapStore.getState()
  updateTrainSession((session) => ({
    ...session,
    cameraFrame: 0,
    cameraTrack: pickCameraTrack(
      stations.cameraGroups,
      TRAIN_BOARDING_CAMERA_GROUPS.get(getBoardingLanding(station, train)),
    ),
    riderRestoreVehicleId: vehicleId,
  }))
  useWorldmapStore.setState({
    vehicleId: station === TRAIN_STATION_OF_RAIL_1 ? TRAIN_STATION_EXIT_VEHICLE : TRAIN_RIDE_VEHICLE,
    worldMapState: WORLD_MAP_STATE_RIDING_TRAIN_0 + slot,
  })
  const position = useGlobalStore.getState().characterPosition
  const car = train.cars[TRAIN_RIDDEN_CAR_INDEX]
  if (position && car) {
    setWorldFromRailPoint(position, car)
  }
}

const runBoarding = (stations: TrainStations, session: TrainSession, position: WorldPosition) => {
  const station = runLocationScripts(stations.scripts, position)
  const slot = station === undefined ? -1 : findStationTrainSlot(session, station)
  const train = session.trains[slot]
  if (station === undefined || !train) {
    return
  }
  if (promptOnce(slot, train, getBoundForMessage(station, train))) {
    setWorldMapState(WORLD_MAP_STATE_HELD_PROMPT)
    return
  }
  const choice = readChoice()
  if (choice < 0) {
    return
  }
  setTrainStopTicks(slot, 0)
  if (choice !== 0) {
    setWorldMapState(WORLD_MAP_STATE_FREE_ROAM)
    return
  }
  if ((MEMORY[TRAIN_GIL_ADDRESS] ?? 0) < TRAIN_FARE) {
    showDialog(TRAIN_NO_GIL_DIALOG_SLOT, TRAIN_NO_GIL_MESSAGE)
    setWorldMapState(WORLD_MAP_STATE_FREE_ROAM)
    return
  }
  boardTrain(stations, slot, train, station)
}

const canBoard = (worldMapState: number, vehicleId: number) =>
  isOnFootClass(vehicleId) &&
  (worldMapState === WORLD_MAP_STATE_FREE_ROAM || worldMapState === WORLD_MAP_STATE_HELD_PROMPT)

export const runTrainStations = (stations: TrainStations, position: WorldPosition) => {
  const session = getTrainSession()
  const { vehicleId, worldMapState } = useWorldmapStore.getState()
  if (!session) {
    return
  }
  if (isTrainClass(vehicleId) && isRidingFreeRoamTrain(worldMapState)) {
    runRideStop(stations, session, worldMapState)
    return
  }
  if (canBoard(worldMapState, vehicleId)) {
    runBoarding(stations, session, position)
  }
}
