import {
  battleTransitionController,
  useBattleTransitionStore,
} from '../../../BattleTransition/BattleTransitionController'
import { WORLDMAP_PAD_BITS } from '../../../constants/controls'
import { VEHICLE_IDS } from '../../../constants/vehicles'
import { GARDEN_INTERIOR_ENTRANCE, RAGNAROK_INTERIOR_ENTRANCE } from '../../../constants/worldmapTransitions'
import useGlobalStore from '../../../store'
import { framesToMs } from '../../../timing'
import { WON_BATTLE_RESULT } from '../Scripts/constants'
import { EventOutcome } from '../Scripts/eventActions'
import { ScriptSection } from '../Scripts/runScript'
import { runEventScripts, runLocationScripts } from '../Scripts/sectionRunners'
import { WORLDMAP_STATE } from '../Scripts/state'
import { WorldPosition } from '../types'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../worldmapStore'

type DirectorScripts = {
  eventScripts: ScriptSection
  locationScripts: ScriptSection
}

const INTERIOR_ENTRANCES: Partial<Record<number, number>> = {
  [VEHICLE_IDS.BALAMB_GARDEN]: GARDEN_INTERIOR_ENTRANCE,
  [VEHICLE_IDS.RAGNAROK]: RAGNAROK_INTERIOR_ENTRANCE,
}

const isMenuButtonPressed = () => (WORLDMAP_STATE.padPressed & WORLDMAP_PAD_BITS.menu) !== 0

const findInteriorEntrance = (vehicleId: number) => (isMenuButtonPressed() ? INTERIOR_ENTRANCES[vehicleId] : undefined)

const findFieldEntrance = (locationScripts: ScriptSection, position: WorldPosition) =>
  runLocationScripts(locationScripts, position) ?? findInteriorEntrance(useWorldmapStore.getState().vehicleId)

export const findDirectorOutcome = (
  { eventScripts, locationScripts }: DirectorScripts,
  position: WorldPosition,
): EventOutcome | undefined => {
  const eventOutcome = runEventScripts(eventScripts, position)
  if (eventOutcome || useWorldmapStore.getState().worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
    return eventOutcome
  }
  const entranceIndex = findFieldEntrance(locationScripts, position)
  return entranceIndex === undefined ? undefined : { entranceIndex, kind: 'field' }
}

export const isDirectorPaused = () =>
  useWorldmapStore.getState().isExiting || useBattleTransitionStore.getState().startFrame !== undefined

export const playWorldmapBattle = async (encounterId: number) => {
  WORLDMAP_STATE.lastCombatSceneId = encounterId
  await battleTransitionController.play(encounterId)
  WORLDMAP_STATE.battleResult = WON_BATTLE_RESULT
}

export const fadeInWorldmap = (frames: number) => {
  const { fadeSpring } = useGlobalStore.getState()
  fadeSpring.set(0)
  fadeSpring.start(1, framesToMs(frames))
}
