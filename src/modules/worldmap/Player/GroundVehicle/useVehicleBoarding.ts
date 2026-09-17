import { useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Object3D } from 'three'

import { WORLDMAP_PAD_BITS } from '../../../../constants/controls'
import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { GARDEN_LANDING_FRAMES, VEHICLE_BOARDING_HEIGHT_TOLERANCE } from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { EntityRecord, getEntity, WORLDMAP_STATE } from '../../Scripts/state'
import { hasAccessBit, TerrainTriangle } from '../../terrain'
import useScriptTick from '../../useScriptTick'
import { isOnFootClass } from '../../vehicleClasses'
import { getBoardableVehicleId } from '../../vehicleEntities'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM, WORLD_MAP_STATE_GARDEN_LANDING } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import { findDisembarkSpot } from '../disembarkUtils'
import { isPadInputIgnored } from '../onFootInput'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection } from '../playerAngles'
import { findTopTriangle, getTriangleAltitude, readShipPose, ShipPose } from '../shipPose'
import { getGroundVehicleState, setGroundVehicleState, startGroundVehicleTrip } from './groundVehicleState'
import {
  buildDisembarkRule,
  finishDisembark,
  getGroundVehicle,
  getVehicleAnchorEntity,
  GroundVehicle,
  parkVehicle,
  writeEntityPosition,
} from './groundVehicleUtils'

const isConfirmPressed = (pressed: number) => (pressed & WORLDMAP_PAD_BITS.confirm) !== 0

const canBoardFrom = (anchor: EntityRecord, triangle: TerrainTriangle | undefined, vehicle: GroundVehicle) =>
  triangle !== undefined &&
  hasAccessBit(triangle, vehicle.leaveBit) &&
  Math.abs(anchor.positionVerticalY - triangle.psxY) < VEHICLE_BOARDING_HEIGHT_TOLERANCE

const findCandidateVehicle = () => {
  const candidate = getEntity(WORLDMAP_STATE.looseCandidate)
  const vehicleId = candidate && getBoardableVehicleId(candidate.typeCode)
  const vehicle = vehicleId === undefined ? undefined : getGroundVehicle(vehicleId)
  const anchor = vehicle && getVehicleAnchorEntity(vehicle)
  if (vehicleId === undefined || !vehicle || !anchor) {
    return undefined
  }
  return { anchor, vehicle, vehicleId }
}

const tryBoardVehicle = () => {
  const position = useGlobalStore.getState().characterPosition
  const candidate = findCandidateVehicle()
  if (!position || !candidate || !canBoardFrom(candidate.anchor, WORLDMAP_STATE.locationTriangle, candidate.vehicle)) {
    return
  }
  startGroundVehicleTrip(useWorldmapStore.getState().vehicleId)
  writeEntityPosition(position, candidate.anchor)
  WORLDMAP_STATE.isButtonInputConsumed = true
  useGlobalStore.setState({ fieldDirection: convertHeadingToFieldDirection(candidate.anchor.yaw) })
  useWorldmapStore.setState({ cameraModeIndex: 0, vehicleId: candidate.vehicleId })
}

const startGardenLanding = (scene: Object3D, pose: ShipPose, spot: ShipPose) => {
  const ground = findTopTriangle(scene, pose.x, pose.z)
  const groundAltitude = ground ? getTriangleAltitude(ground) : pose.altitude
  setGroundVehicleState({
    ...getGroundVehicleState(),
    landing: {
      altitudeStep: Math.trunc((groundAltitude - pose.altitude) / GARDEN_LANDING_FRAMES),
      elapsedTicks: 0,
      spot,
    },
    velocity: 0,
  })
  useWorldmapStore.setState({ worldMapState: WORLD_MAP_STATE_GARDEN_LANDING })
}

const tryLeaveVehicle = (scene: Object3D, vehicleId: number, vehicle: GroundVehicle) => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return
  }
  const pose = readShipPose(characterPosition)
  const heading = convertFieldDirectionToHeading(fieldDirection)
  const spot = findDisembarkSpot(scene, pose, heading, buildDisembarkRule(vehicle))
  if (!spot) {
    return
  }
  WORLDMAP_STATE.isButtonInputConsumed = true
  if (vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    startGardenLanding(scene, pose, spot)
    return
  }
  parkVehicle(vehicle, pose, heading)
  finishDisembark(spot)
}

const runBoardingTick = (scene: Object3D, pressed: number, tick: number) => {
  const { vehicleId, worldMapState } = useWorldmapStore.getState()
  if (
    worldMapState !== WORLD_MAP_STATE_FREE_ROAM ||
    isPadInputIgnored(tick) ||
    !isConfirmPressed(pressed) ||
    WORLDMAP_STATE.isButtonInputConsumed
  ) {
    return
  }
  const vehicle = getGroundVehicle(vehicleId)
  if (vehicle) {
    tryLeaveVehicle(scene, vehicleId, vehicle)
    return
  }
  if (isOnFootClass(vehicleId)) {
    tryBoardVehicle()
  }
}

const useVehicleBoarding = () => {
  const scene = useThree((state) => state.scene)
  const previousPadButtonsRef = useRef(0)

  useScriptTick(
    (tick) => {
      const { padButtons } = useWorldmapStore.getState().controls
      runBoardingTick(scene, padButtons & ~previousPadButtonsRef.current, tick)
      previousPadButtonsRef.current = padButtons
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useVehicleBoarding
