import { WORLDMAP_ENTRY_FROM_FIELD } from '../../constants/worldmapTransitions'
import useGlobalStore from '../../store'
import useWorldmapStore from '../worldmap/worldmapStore'
import { awaitFadesync, triggerFadeout } from './Scripts/Script/common'

type WorldmapJump = {
  rideDestinationEntrance: number
  spawnPointId: number
  vehicleId: number
}

export const jumpToWorldmap = async ({ rideDestinationEntrance, spawnPointId, vehicleId }: WorldmapJump) => {
  if (useGlobalStore.getState().isMapFadeEnabled) {
    triggerFadeout()
    await awaitFadesync()
  }
  useWorldmapStore.setState({
    entryMode: WORLDMAP_ENTRY_FROM_FIELD,
    rideDestinationEntrance,
    spawnPointId,
    vehicleId,
  })
  useGlobalStore.setState({
    characterPosition: undefined,
    module: 'worldmap',
    pendingCharacterPosition: undefined,
    pendingFieldId: undefined,
  })
}
