import { useThree } from '@react-three/fiber'
import { Object3D } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../../constants/controls'
import { VEHICLE_IDS } from '../../../../constants/vehicles'
import useGlobalStore from '../../../../store'
import { MEMORY } from '../../../field/Scripts/Script/handlers'
import { getPadPresses } from '../../Controls/padPresses'
import { getAllEntities, WORLDMAP_STATE } from '../../Scripts/state'
import useScriptTick from '../../useScriptTick'
import { isOnFootClass } from '../../vehicleClasses'
import { writeSavedCameraMode } from '../../worldmapSaveData'
import useWorldmapStore, {
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import { isPadInputIgnored } from '../onFootInput'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection } from '../playerAngles'
import { readShipPose, writeShipPose } from '../shipPose'
import { findBoardableRagnarok, findLandingSpot } from './boardingUtils'
import { readRagnarokEntityPose } from './ragnarokEntity'
import { getRagnarokOutputs, getRagnarokTrip, setRagnarokOutputs, setRagnarokTrip } from './ragnarokState'

const CONFIRM_BIT = WORLDMAP_PAD_BITS.confirm
const CAMERA_MODE_BIT = WORLDMAP_PAD_BITS.toggleCameraMode

const isPressed = (pressed: number, bit: number) => (pressed & bit) !== 0

const toggleCameraMode = () => {
  const cameraModeIndex = useWorldmapStore.getState().cameraModeIndex === 0 ? 1 : 0
  writeSavedCameraMode(MEMORY, cameraModeIndex)
  useWorldmapStore.setState({ cameraModeIndex })
}

const tryBoardRagnarok = () => {
  const position = useGlobalStore.getState().characterPosition
  if (!position) {
    return
  }
  const ship = findBoardableRagnarok({
    entities: getAllEntities(),
    player: readShipPose(position),
    playerTriangle: WORLDMAP_STATE.locationTriangle,
  })
  if (!ship) {
    return
  }
  writeShipPose(position, readRagnarokEntityPose(ship))
  setRagnarokTrip({ landingSpot: null, restoredVehicleId: useWorldmapStore.getState().vehicleId })
  setRagnarokOutputs({ ...getRagnarokOutputs(), bank: 0, velocity: 0 })
  WORLDMAP_STATE.isButtonInputConsumed = true
  useGlobalStore.setState({ fieldDirection: convertHeadingToFieldDirection(ship.yaw) })
  useWorldmapStore.setState({
    cameraModeIndex: 0,
    vehicleId: VEHICLE_IDS.RAGNAROK,
    worldMapState: WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
  })
}

const tryStartLanding = (scene: Object3D) => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return
  }
  const landingSpot = findLandingSpot(
    scene,
    readShipPose(characterPosition),
    convertFieldDirectionToHeading(fieldDirection),
  )
  if (!landingSpot) {
    return
  }
  setRagnarokTrip({ ...getRagnarokTrip(), landingSpot })
  WORLDMAP_STATE.isButtonInputConsumed = true
  useWorldmapStore.setState({ worldMapState: WORLD_MAP_STATE_RAGNAROK_LANDING })
}

const runActionTick = (scene: Object3D, pressed: number, tick: number) => {
  if (useWorldmapStore.getState().worldMapState !== WORLD_MAP_STATE_FREE_ROAM || isPadInputIgnored(tick)) {
    return
  }
  if (isPressed(pressed, CAMERA_MODE_BIT)) {
    toggleCameraMode()
  }
  if (!isPressed(pressed, CONFIRM_BIT) || WORLDMAP_STATE.isButtonInputConsumed) {
    return
  }
  const { vehicleId } = useWorldmapStore.getState()
  if (vehicleId === VEHICLE_IDS.RAGNAROK) {
    tryStartLanding(scene)
    return
  }
  if (isOnFootClass(vehicleId)) {
    tryBoardRagnarok()
  }
}

const useActionButton = () => {
  const scene = useThree((state) => state.scene)

  useScriptTick(
    (tick) => {
      runActionTick(scene, getPadPresses(tick), tick)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useActionButton
