import { create } from 'zustand'

import { VEHICLE_IDS } from '../../constants/vehicles'
import { WORLDMAP_CAMERA_DEPTH_DEFAULT, WORLDMAP_CURVATURE_START_DEFAULT } from '../../constants/worldmapCamera'
import useGlobalStore from '../../store'

export type WorldmapCameraState = {
  curvatureStart: number
  depth: number
  yawRadians: number
}

export type WorldmapControlsState = {
  isAccelerating: boolean
  isBraking: boolean
  isRunning: boolean
  isWalkingSlow: boolean
  moveX: number
  moveY: number
  padButtons: number
}

export const WORLD_MAP_STATE_FREE_ROAM = 0
export const WORLD_MAP_STATE_RAGNAROK_LANDING = 5
export const WORLD_MAP_STATE_RAGNAROK_TAKEOFF = 6
export const WORLD_MAP_STATE_GARDEN_LANDING = 8
export const WORLD_MAP_STATE_GARDEN_TAKEOFF = 9

export type WorldmapState = {
  camera: WorldmapCameraState
  cameraModeIndex: number
  controls: WorldmapControlsState
  entryMode: number
  minimapMode: number
  skyLightColor1: [number, number, number]
  skyLightColor2: [number, number, number]
  spawnPointId: number
  vehicleId: number
  worldMapState: number
}

const INITIAL_STATE: WorldmapState = {
  camera: { curvatureStart: WORLDMAP_CURVATURE_START_DEFAULT, depth: WORLDMAP_CAMERA_DEPTH_DEFAULT, yawRadians: 0 },
  cameraModeIndex: 0,
  controls: {
    isAccelerating: false,
    isBraking: false,
    isRunning: false,
    isWalkingSlow: false,
    moveX: 0,
    moveY: 0,
    padButtons: 0,
  },
  entryMode: 0,
  minimapMode: 0,
  skyLightColor1: [64, 64, 64],
  skyLightColor2: [128, 128, 128],
  spawnPointId: 0,
  vehicleId: VEHICLE_IDS.ON_FOOT,
  worldMapState: WORLD_MAP_STATE_FREE_ROAM,
}

const useWorldmapStore = create<WorldmapState>()(() => ({ ...INITIAL_STATE }))

export const mirrorVehicleIdToGlobalStore = () => {
  useGlobalStore.setState({ vehicleId: useWorldmapStore.getState().vehicleId })
  return useWorldmapStore.subscribe((state, previousState) => {
    if (state.vehicleId !== previousState.vehicleId) {
      useGlobalStore.setState({ vehicleId: state.vehicleId })
    }
  })
}

export default useWorldmapStore
