import {
  CHOCOBO_MUSIC_ID,
  RAGNAROK_MUSIC_ID,
  RAGNAROK_MUSIC_START_MEASURE,
  WORLDMAP_MUSIC_ID,
} from '../../../constants/audio'
import { VEHICLE_IDS } from '../../../constants/vehicles'
import { isChocobo } from '../vehicleClasses'
import {
  WORLD_MAP_STATE_CHOCOBO_DISMOUNT,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../worldmapStore'

type WorldmapMusicAction = 'mute' | 'none' | 'start'

type WorldmapMusicActionInput = {
  playingMusicId: null | number
  targetMusicId: number
  worldMapState: number
}

const isVehicleChangeInProgress = (worldMapState: number) =>
  worldMapState === WORLD_MAP_STATE_RAGNAROK_TAKEOFF ||
  worldMapState === WORLD_MAP_STATE_RAGNAROK_LANDING ||
  worldMapState === WORLD_MAP_STATE_CHOCOBO_DISMOUNT

const isFlyingRagnarok = (vehicleId: number, worldMapState: number) =>
  vehicleId === VEHICLE_IDS.RAGNAROK && worldMapState !== WORLD_MAP_STATE_RAGNAROK_LANDING

const isRidingChocobo = (vehicleId: number, worldMapState: number) =>
  isChocobo(vehicleId) && worldMapState !== WORLD_MAP_STATE_CHOCOBO_DISMOUNT

export const getTargetMusicId = (vehicleId: number, worldMapState: number) => {
  if (isFlyingRagnarok(vehicleId, worldMapState)) {
    return RAGNAROK_MUSIC_ID
  }
  return isRidingChocobo(vehicleId, worldMapState) ? CHOCOBO_MUSIC_ID : WORLDMAP_MUSIC_ID
}

export const getWorldmapMusicAction = ({
  playingMusicId,
  targetMusicId,
  worldMapState,
}: WorldmapMusicActionInput): WorldmapMusicAction => {
  if (targetMusicId === playingMusicId) {
    return 'none'
  }
  if (isVehicleChangeInProgress(worldMapState)) {
    return 'mute'
  }
  return 'start'
}

export const getMusicStartMeasure = (musicId: number) =>
  musicId === RAGNAROK_MUSIC_ID ? RAGNAROK_MUSIC_START_MEASURE : undefined
