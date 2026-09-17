import { WORLDMAP_ENTRY_FROM_FIELD, WORLDMAP_ENTRY_FROM_SAVE } from '../../constants/worldmapTransitions'
import useGlobalStore from '../../store'
import { convertRadiansToCameraYaw } from './Camera/cameraUtils'
import { buildSavedVehiclePosition } from './worldmapEntry'
import { Memory, writeSavedPartyState, writeSavedVehiclePosition } from './worldmapSaveData'
import useWorldmapStore from './worldmapStore'

const POSITION_PARAMS = ['x', 'y', 'z', 'yaw'] as const
const CAMERA_PARAM = 'camera'
const VEHICLE_PARAM = 'vehicle'
const SPAWN_POINT_PARAM = 'spawnPointId'

export const WORLDMAP_URL_PARAMS = [...POSITION_PARAMS, CAMERA_PARAM, VEHICLE_PARAM, SPAWN_POINT_PARAM] as const

const readInteger = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  return value === null ? undefined : parseInt(value)
}

const readUrlPosition = (params: URLSearchParams) => {
  const [x, y, altitude, yaw] = POSITION_PARAMS.map((key) => readInteger(params, key))
  if (x === undefined || y === undefined) {
    return undefined
  }
  return { altitude: altitude ?? 0, x, y, yaw: yaw ?? 0 }
}

const getCurrentVehicleId = (params: URLSearchParams) =>
  readInteger(params, VEHICLE_PARAM) ?? useWorldmapStore.getState().vehicleId

export const applyWorldmapUrlParams = (params: URLSearchParams, memory: Memory) => {
  const vehicleId = getCurrentVehicleId(params)
  const position = readUrlPosition(params)
  if (!position) {
    useWorldmapStore.setState({
      entryMode: WORLDMAP_ENTRY_FROM_FIELD,
      spawnPointId: readInteger(params, SPAWN_POINT_PARAM) ?? 0,
      vehicleId,
    })
    return
  }
  writeSavedVehiclePosition(memory, vehicleId, position)
  writeSavedPartyState(memory, { cameraYaw: readInteger(params, CAMERA_PARAM) ?? 0, vehicleId })
  useWorldmapStore.setState({ entryMode: WORLDMAP_ENTRY_FROM_SAVE, vehicleId })
}

export const buildWorldmapUrlParams = () => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return undefined
  }
  const { camera, vehicleId } = useWorldmapStore.getState()
  const { altitude, x, y, yaw } = buildSavedVehiclePosition(characterPosition, fieldDirection)
  return {
    [CAMERA_PARAM]: convertRadiansToCameraYaw(camera.yawRadians),
    [VEHICLE_PARAM]: vehicleId,
    x,
    y,
    yaw,
    z: altitude,
  }
}
