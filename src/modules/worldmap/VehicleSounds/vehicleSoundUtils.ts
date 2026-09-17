import { MathUtils } from 'three'

import {
  BOAT_SOUND_DEPTH_SHIFT,
  BOAT_SOUND_MAX_VOLUME,
  BOAT_SOUND_MIN_VOLUME,
  CAR_ENGINE_SOUND_ID,
  GARDEN_WATER_ALTITUDE_SHIFT,
  GARDEN_WATER_BASE_VOLUME,
  GROUND_ENGINE_BASE_VOLUME,
  GROUND_ENGINE_SPEED_SHIFT,
  LATE_CAR_ENGINE_SOUND_ID,
  LATE_CAR_VEHICLE_IDS,
  WORLDMAP_SOUND_MAX_VOLUME,
} from '../../../constants/audio'
import { VEHICLE_IDS } from '../../../constants/vehicles'
import useGlobalStore from '../../../store'
import { isGardenWaterGround } from '../Player/groundProfiles'
import { getGroundVehicleState } from '../Player/GroundVehicle/groundVehicleState'
import { WORLDMAP_STATE } from '../Scripts/state'
import { worldYToPsxHeight } from '../terrain'
import { isCarClass } from '../vehicleClasses'
import useWorldmapStore from '../worldmapStore'

const toInt16 = (value: number) => (Math.trunc(value) << 16) >> 16

const clampVolume = (volume: number) => MathUtils.clamp(volume, 0, WORLDMAP_SOUND_MAX_VOLUME)

export const getCarEngineSoundId = (vehicleId: number) => {
  if (!isCarClass(vehicleId)) {
    return undefined
  }
  return LATE_CAR_VEHICLE_IDS.has(vehicleId) ? LATE_CAR_ENGINE_SOUND_ID : CAR_ENGINE_SOUND_ID
}

export const calculateGroundEngineVolume = (speed: number) =>
  clampVolume(GROUND_ENGINE_BASE_VOLUME + (Math.trunc(Math.abs(speed)) >> GROUND_ENGINE_SPEED_SHIFT))

export const calculateGardenWaterVolume = (altitude: number) =>
  clampVolume(GARDEN_WATER_BASE_VOLUME + (Math.trunc(altitude) >> GARDEN_WATER_ALTITUDE_SHIFT))

export const calculateBoatVolume = (cameraDepth: number) => {
  const distance = clampVolume(Math.abs(toInt16(cameraDepth)) >> BOAT_SOUND_DEPTH_SHIFT)
  return MathUtils.clamp(WORLDMAP_SOUND_MAX_VOLUME - (distance >> 1), BOAT_SOUND_MIN_VOLUME, BOAT_SOUND_MAX_VOLUME)
}

export const getGroundEngineVolume = () => calculateGroundEngineVolume(getGroundVehicleState().velocity)

export const getGardenWaterVolume = () => {
  const position = useGlobalStore.getState().characterPosition
  return position ? calculateGardenWaterVolume(worldYToPsxHeight(position.y)) : 0
}

export const getBoatVolume = () => calculateBoatVolume(useWorldmapStore.getState().camera.depth)

export const getIsGardenOverWater = () => {
  const groundType = WORLDMAP_STATE.locationTriangle?.groundType
  return (
    useWorldmapStore.getState().vehicleId === VEHICLE_IDS.BALAMB_GARDEN &&
    groundType !== undefined &&
    isGardenWaterGround(groundType)
  )
}
