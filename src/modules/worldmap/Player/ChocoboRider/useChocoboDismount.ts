import { useThree } from '@react-three/fiber'
import { Object3D } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../../constants/controls'
import { CHOCOBO_DISMOUNT_TICKS } from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { getPadPresses } from '../../Controls/padPresses'
import { WORLDMAP_STATE } from '../../Scripts/state'
import useScriptTick from '../../useScriptTick'
import { isChocobo } from '../../vehicleClasses'
import useWorldmapStore, { WORLD_MAP_STATE_CHOCOBO_DISMOUNT, WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import { isPadInputIgnored } from '../onFootInput'
import { convertFieldDirectionToHeading } from '../playerAngles'
import { readShipPose, writeShipPose } from '../shipPose'
import { buildChocoboPose, findChocoboDismountSpot, getPartyVehicleId, stepDismountFrame } from './chocoboDismountUtils'
import { ChocoboDismount, getChocoboRiderState, updateChocoboRiderState } from './chocoboRiderState'

const isConfirmPressed = (pressed: number) => (pressed & WORLDMAP_PAD_BITS.confirm) !== 0

const canStartDismount = (pressed: number, tick: number) => {
  const { vehicleId, worldMapState } = useWorldmapStore.getState()
  return (
    isChocobo(vehicleId) &&
    worldMapState === WORLD_MAP_STATE_FREE_ROAM &&
    !isPadInputIgnored(tick) &&
    isConfirmPressed(pressed) &&
    !WORLDMAP_STATE.isButtonInputConsumed
  )
}

const tryStartDismount = (scene: Object3D) => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return
  }
  const heading = convertFieldDirectionToHeading(fieldDirection)
  const spot = findChocoboDismountSpot(scene, readShipPose(characterPosition), heading)
  console.log('[dismount-debug] chocobo spot', { heading, pose: readShipPose(characterPosition), spot })
  if (!spot) {
    return
  }
  WORLDMAP_STATE.isButtonInputConsumed = true
  updateChocoboRiderState({
    dismount: { elapsedTicks: 0, spot },
    dismountFrame: 0,
    runOff: { phase: 'starting', pose: buildChocoboPose(characterPosition, heading) },
  })
  useWorldmapStore.setState({ worldMapState: WORLD_MAP_STATE_CHOCOBO_DISMOUNT })
}

const finishDismount = (dismount: ChocoboDismount) => {
  const position = useGlobalStore.getState().characterPosition
  if (position) {
    writeShipPose(position, dismount.spot)
  }
  updateChocoboRiderState({ dismount: null })
  useWorldmapStore.setState({ vehicleId: getPartyVehicleId(), worldMapState: WORLD_MAP_STATE_FREE_ROAM })
}

const advanceDismount = () => {
  const { dismount, dismountFrame } = getChocoboRiderState()
  if (!dismount || useWorldmapStore.getState().worldMapState !== WORLD_MAP_STATE_CHOCOBO_DISMOUNT) {
    return
  }
  const elapsedTicks = dismount.elapsedTicks + 1
  updateChocoboRiderState({ dismount: { ...dismount, elapsedTicks }, dismountFrame: stepDismountFrame(dismountFrame) })
  if (elapsedTicks >= CHOCOBO_DISMOUNT_TICKS) {
    finishDismount(dismount)
  }
}

const runDismountTick = (scene: Object3D, pressed: number, tick: number) => {
  if (isConfirmPressed(pressed)) {
    const { vehicleId, worldMapState } = useWorldmapStore.getState()
    console.log('[dismount-debug] chocobo confirm seen', {
      isButtonInputConsumed: WORLDMAP_STATE.isButtonInputConsumed,
      isChocobo: isChocobo(vehicleId),
      isPadInputIgnored: isPadInputIgnored(tick),
      tick,
      vehicleId,
      worldMapState,
    })
  }
  if (canStartDismount(pressed, tick)) {
    tryStartDismount(scene)
  }
  advanceDismount()
}

const useChocoboDismount = () => {
  const scene = useThree((state) => state.scene)

  useScriptTick(
    (tick) => {
      runDismountTick(scene, getPadPresses(tick), tick)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useChocoboDismount
