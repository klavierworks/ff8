import { convertRadiansToCameraYaw } from './Camera/cameraUtils'
import { getRagnarokEntity } from './Player/FlyingRagnarok/ragnarokEntity'
import {
  Memory,
  readSavedWorldmapModes,
  writeSavedPartyState,
  writeSavedRagnarok,
  writeSavedWorldmapModes,
} from './worldmapSaveData'
import useWorldmapStore from './worldmapStore'

export const restoreWorldmapEntryState = (memory: Memory) => {
  useWorldmapStore.setState(readSavedWorldmapModes(memory))
}

export const saveWorldmapExitState = (memory: Memory) => {
  const { camera, cameraModeIndex, minimapMode, vehicleId } = useWorldmapStore.getState()
  writeSavedWorldmapModes(memory, { cameraModeIndex, minimapMode })
  writeSavedPartyState(memory, { cameraYaw: convertRadiansToCameraYaw(camera.yawRadians), vehicleId })
  const ragnarok = getRagnarokEntity()
  if (!ragnarok) {
    return
  }
  writeSavedRagnarok(memory, {
    altitude: ragnarok.positionVerticalY,
    x: ragnarok.positionX,
    y: ragnarok.positionY,
    yaw: ragnarok.yaw,
  })
}
