import { Vector3 } from 'three'

import { VEHICLE_IDS } from '../../constants/vehicles'
import { RAGNAROK_ENTITY_TYPE } from '../../constants/worldmapEntities'
import { WORLDMAP_ENTRY_FROM_FIELD } from '../../constants/worldmapTransitions'
import useGlobalStore from '../../store'
import { convertRadiansToCameraYaw } from './Camera/cameraUtils'
import { resetRagnarokState } from './Player/FlyingRagnarok/ragnarokState'
import { resetGroundVehicleState } from './Player/GroundVehicle/groundVehicleState'
import { getGroundVehicle } from './Player/GroundVehicle/groundVehicleUtils'
import { closeAllDialogs } from './Scripts/dialog'
import { EntityRecord, getAllEntities, resetScriptState } from './Scripts/state'
import { setWorldFromRailPoint } from './Trains/trainPlacement'
import { findRiddenCar, RideCameraGroups, startTrainSession } from './Trains/trainRide'
import { resetTrainSession, setTrainSession } from './Trains/trainSession'
import { FieldLandingPosition } from './useSections'
import { isCarClass } from './vehicleClasses'
import { getBoardableVehicleId, getCarEntityType } from './vehicleEntities'
import { buildSavedVehiclePosition, resolveWorldmapEntry, WorldmapEntry } from './worldmapEntry'
import {
  Memory,
  readSavedWorldmapModes,
  writeSavedCarEntityType,
  writeSavedPartyState,
  writeSavedVehiclePosition,
  writeSavedWorldmapModes,
} from './worldmapSaveData'
import useWorldmapStore from './worldmapStore'

const resetWorldmapSession = () => {
  resetScriptState()
  resetRagnarokState()
  resetGroundVehicleState()
  resetTrainSession()
  closeAllDialogs()
}

const recordArrivingCar = (memory: Memory, entryMode: number, vehicleId: number) => {
  const typeCode = getCarEntityType(vehicleId)
  if (entryMode !== WORLDMAP_ENTRY_FROM_FIELD || !isCarClass(vehicleId) || typeCode === undefined) {
    return
  }
  writeSavedCarEntityType(memory, typeCode)
}

const seedDrivenVehicleRecord = (memory: Memory, vehicleId: number, entry: WorldmapEntry) => {
  if (!getGroundVehicle(vehicleId)) {
    return
  }
  writeSavedVehiclePosition(memory, vehicleId, buildSavedVehiclePosition(entry.position, entry.fieldDirection))
}

export const enterWorldmap = (
  memory: Memory,
  landings: readonly FieldLandingPosition[],
  rideCameraGroups: RideCameraGroups,
) => {
  resetWorldmapSession()
  const { entryMode, spawnPointId, vehicleId } = useWorldmapStore.getState()
  recordArrivingCar(memory, entryMode, vehicleId)
  const entry = resolveWorldmapEntry({ entryMode, landings, memory, spawnPointId, vehicleId })
  seedDrivenVehicleRecord(memory, vehicleId, entry)
  const { rideDestinationEntrance } = useWorldmapStore.getState()
  const trains = startTrainSession(
    { destinationEntrance: rideDestinationEntrance, entryMode, spawnPointId, vehicleId },
    rideCameraGroups,
  )
  setTrainSession(trains.session)
  const riddenCar = findRiddenCar(trains.session, trains.worldMapState)
  useWorldmapStore.setState({
    ...readSavedWorldmapModes(memory),
    entryCameraYaw: entry.cameraYaw,
    isExiting: false,
    worldMapState: trains.worldMapState,
  })
  useGlobalStore.setState({
    characterPosition: riddenCar ? setWorldFromRailPoint(new Vector3(), riddenCar) : entry.position,
    fieldDirection: entry.fieldDirection,
  })
}

const getParkedVehicleId = (entity: EntityRecord) =>
  entity.typeCode === RAGNAROK_ENTITY_TYPE ? VEHICLE_IDS.RAGNAROK : getBoardableVehicleId(entity.typeCode)

const saveParkedVehicles = (memory: Memory) => {
  getAllEntities().forEach((entity) => {
    const vehicleId = getParkedVehicleId(entity)
    if (vehicleId === undefined) {
      return
    }
    writeSavedVehiclePosition(memory, vehicleId, {
      altitude: entity.positionVerticalY,
      x: entity.positionX,
      y: entity.positionY,
      yaw: entity.yaw,
    })
  })
}

const savePartyPosition = (memory: Memory, vehicleId: number) => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return
  }
  writeSavedVehiclePosition(memory, vehicleId, buildSavedVehiclePosition(characterPosition, fieldDirection))
}

export const saveWorldmapExitState = (memory: Memory) => {
  const { camera, cameraModeIndex, minimapMode, vehicleId } = useWorldmapStore.getState()
  writeSavedWorldmapModes(memory, { cameraModeIndex, minimapMode })
  writeSavedPartyState(memory, { cameraYaw: convertRadiansToCameraYaw(camera.yawRadians), vehicleId })
  saveParkedVehicles(memory)
  savePartyPosition(memory, vehicleId)
}
