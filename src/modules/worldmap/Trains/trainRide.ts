import type { WorldmapRails } from '@data/types/worldmap/WorldmapRails'
import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import railsData from '@data/worldmap/rails.json'

import { VEHICLE_IDS } from '../../../constants/vehicles'
import {
  BOAT_RIDE_CAR_COUNT,
  BOAT_RIDE_RIDDEN_CAR_INDEX,
  BOAT_RIDE_TOP_SPEED,
  RIDE_VEHICLE_ENTITY_TYPES,
  TRAIN_BOARDING_CAMERA_GROUPS,
  TRAIN_CAR_COUNT,
  TRAIN_CAR_LINKS,
  TRAIN_DISABLED_BIT,
  TRAIN_FREE_ROAM_RAILS,
  TRAIN_RAIL_COUNT,
  TRAIN_RIDDEN_CAR_INDEX,
  TRAIN_STATION_LANDING_MAX,
  TRAIN_STATION_LANDING_MIN,
  TRAIN_STORY_FLAGS_ADDRESS,
  TRAIN_STORY_HOLD_BIT,
  TRAIN_TOP_SPEED,
  TRAIN_UNSET_BYTE,
} from '../../../constants/worldmapTrains'
import { WORLDMAP_ENTRY_FROM_FIELD } from '../../../constants/worldmapTransitions'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { isBoatClass, isCarClass, isTrainClass } from '../vehicleClasses'
import { getCarEntityType } from '../vehicleEntities'
import {
  WORLD_MAP_STATE_BOAT_RIDE,
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RIDING_TRAIN_0,
  WORLD_MAP_STATE_RIDING_TRAIN_1,
  WORLD_MAP_STATE_SCRIPTED_TRAIN_RIDE,
} from '../worldmapStore'
import { calculateRideCameraView } from './rideCamera'
import { getRailCarTypeCode, TrainDirection } from './trainCars'
import { TrainSession } from './trainSession'
import { createTrain, Train } from './trainSimulation'
import { isCameraHeldAtStation } from './trainStops'

export type RideCameraGroups = WorldmapSections['section_17_ride_camera_tracks']['groups']

export type TrainEntry = {
  destinationEntrance: number
  entryMode: number
  spawnPointId: number
  vehicleId: number
}

export type TrainSessionStart = {
  session: TrainSession
  worldMapState: number
}

const RAILS = railsData as unknown as WorldmapRails

export const getRail = (railIndex: number) => RAILS[railIndex]

const toByte = (value: number) => value & 0xff

const isStoryFlagSet = (bit: number) => ((MEMORY[TRAIN_STORY_FLAGS_ADDRESS] ?? 0) & bit) !== 0

export const isStoryHoldSet = () => isStoryFlagSet(TRAIN_STORY_HOLD_BIT)

const isStationLanding = (landing: number) =>
  landing >= TRAIN_STATION_LANDING_MIN && landing <= TRAIN_STATION_LANDING_MAX

const isRideVehicle = (vehicleId: number) => isBoatClass(vehicleId) || isCarClass(vehicleId)

export const isRidingState = (worldMapState: number) =>
  worldMapState >= WORLD_MAP_STATE_BOAT_RIDE && worldMapState <= WORLD_MAP_STATE_RIDING_TRAIN_1

export const isRidingFreeRoamTrain = (worldMapState: number) =>
  worldMapState === WORLD_MAP_STATE_RIDING_TRAIN_0 || worldMapState === WORLD_MAP_STATE_RIDING_TRAIN_1

export const getRiddenTrainSlot = (worldMapState: number) => (worldMapState === WORLD_MAP_STATE_RIDING_TRAIN_1 ? 1 : 0)

const getRiddenCarIndex = (worldMapState: number) =>
  worldMapState === WORLD_MAP_STATE_BOAT_RIDE ? BOAT_RIDE_RIDDEN_CAR_INDEX : TRAIN_RIDDEN_CAR_INDEX

export const findRiddenTrain = (session: TrainSession, worldMapState: number) =>
  isRidingState(worldMapState) ? session.trains[getRiddenTrainSlot(worldMapState)] : undefined

export const findRiddenCar = (session: TrainSession, worldMapState: number) =>
  findRiddenTrain(session, worldMapState)?.cars[getRiddenCarIndex(worldMapState)]

export const getDrawnCarTypeCode = (session: TrainSession, train: Train, carIndex: number) =>
  session.rideVehicleTypeCode ?? getRailCarTypeCode(train.railIndex, carIndex)

export const pickCameraTrack = (cameraGroups: RideCameraGroups, groupIndex: number | undefined) => {
  const tracks = groupIndex === undefined ? [] : (cameraGroups[groupIndex]?.tracks ?? [])
  return tracks.length === 0 ? undefined : tracks[Math.floor(Math.random() * tracks.length)]
}

const createFullTrain = (railIndex: number, direction: TrainDirection) =>
  createTrain(getRail(railIndex), {
    carCount: TRAIN_CAR_COUNT,
    direction,
    hasFlippingLinks: false,
    links: TRAIN_CAR_LINKS,
    railIndex,
    topSpeed: TRAIN_TOP_SPEED,
  })

const createBoatTrain = (railIndex: number, direction: TrainDirection) =>
  createTrain(getRail(railIndex), {
    carCount: BOAT_RIDE_CAR_COUNT,
    direction,
    hasFlippingLinks: true,
    links: [0, direction, 0],
    railIndex,
    topSpeed: BOAT_RIDE_TOP_SPEED,
  })

const buildSession = (entry: TrainEntry, trains: TrainSession['trains'], cameraTrack: TrainSession['cameraTrack']) => ({
  cameraFrame: 0,
  cameraTrack,
  rideDestinationEntrance: toByte(entry.destinationEntrance),
  riderRestoreVehicleId: VEHICLE_IDS.ON_FOOT,
  rideVehicleTypeCode: undefined,
  trains,
})

const startFreeRoam = (entry: TrainEntry): TrainSessionStart => ({
  session: buildSession(
    entry,
    isStoryFlagSet(TRAIN_DISABLED_BIT) ? [] : TRAIN_FREE_ROAM_RAILS.map((railIndex) => createFullTrain(railIndex, 1)),
    undefined,
  ),
  worldMapState: WORLD_MAP_STATE_FREE_ROAM,
})

const startStationArrival = (entry: TrainEntry, cameraGroups: RideCameraGroups): TrainSessionStart => {
  const landing = toByte(entry.spawnPointId)
  const riddenRail = landing <= TRAIN_STATION_LANDING_MIN + 1 ? 0 : 1
  const direction: TrainDirection = landing % 2 === 0 ? 1 : -1
  const otherTrain = isStoryFlagSet(TRAIN_DISABLED_BIT) ? undefined : createFullTrain(1 - riddenRail, direction)
  return {
    session: buildSession(
      entry,
      [createFullTrain(riddenRail, direction), otherTrain],
      pickCameraTrack(cameraGroups, TRAIN_BOARDING_CAMERA_GROUPS.get(landing)),
    ),
    worldMapState: WORLD_MAP_STATE_RIDING_TRAIN_0,
  }
}

const startScriptedRide = (entry: TrainEntry, cameraGroups: RideCameraGroups, isBoat: boolean): TrainSessionStart => {
  const landing = toByte(entry.spawnPointId)
  const railIndex = landing % TRAIN_RAIL_COUNT
  const direction: TrainDirection = landing < TRAIN_RAIL_COUNT ? 1 : -1
  const train = isBoat ? createBoatTrain(railIndex, direction) : createFullTrain(railIndex, direction)
  return {
    session: {
      ...buildSession(entry, [train], pickCameraTrack(cameraGroups, landing)),
      rideVehicleTypeCode: isBoat
        ? (RIDE_VEHICLE_ENTITY_TYPES.get(entry.vehicleId) ?? getCarEntityType(entry.vehicleId))
        : undefined,
    },
    worldMapState: isBoat ? WORLD_MAP_STATE_BOAT_RIDE : WORLD_MAP_STATE_SCRIPTED_TRAIN_RIDE,
  }
}

const hasRideBytes = (entry: TrainEntry) =>
  toByte(entry.spawnPointId) !== TRAIN_UNSET_BYTE && toByte(entry.destinationEntrance) !== TRAIN_UNSET_BYTE

export const startTrainSession = (entry: TrainEntry, cameraGroups: RideCameraGroups): TrainSessionStart => {
  if (entry.entryMode !== WORLDMAP_ENTRY_FROM_FIELD) {
    return startFreeRoam(entry)
  }
  if (isTrainClass(entry.vehicleId) && isStationLanding(toByte(entry.spawnPointId))) {
    return startStationArrival(entry, cameraGroups)
  }
  if (!hasRideBytes(entry)) {
    return startFreeRoam(entry)
  }
  if (isRideVehicle(entry.vehicleId)) {
    return startScriptedRide(entry, cameraGroups, true)
  }
  return isTrainClass(entry.vehicleId) ? startScriptedRide(entry, cameraGroups, false) : startFreeRoam(entry)
}

export const getRideCameraView = (session: null | TrainSession, worldMapState: number) => {
  const train = session && findRiddenTrain(session, worldMapState)
  if (!session?.cameraTrack || !train) {
    return undefined
  }
  const isHeld = isRidingFreeRoamTrain(worldMapState) && isCameraHeldAtStation(train)
  return calculateRideCameraView(session.cameraTrack, session.cameraFrame, train.cars, train.direction, isHeld)
}
