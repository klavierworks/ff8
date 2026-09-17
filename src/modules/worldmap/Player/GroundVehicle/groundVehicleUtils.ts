import { Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import {
  CAR_DISEMBARK_DISTANCE,
  CAR_DRIVING,
  CAR_LEAVE_BIT,
  CAR_SLIDE_DRIFT_SHIFT,
  GARDEN_DISEMBARK_DISTANCE,
  GARDEN_DRIVING,
  GARDEN_LEAVE_BIT,
  GARDEN_SLIDE_DRIFT_SHIFT,
} from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { findCollidingEntity, getEntityFootprintHeight } from '../../Entities/entityCollision'
import { EntityRecord, getAllEntities, getEntity, replaceEntity, WORLDMAP_STATE } from '../../Scripts/state'
import { getOnFootPsxHeight, hasAccessBit, psxHeightToWorldY, TerrainTriangle } from '../../terrain'
import { isStepBlockedByTrain } from '../../Trains/trainCollision'
import { isCarClass } from '../../vehicleClasses'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { CAR_ENTITY_SLOT, GARDEN_ENTITY_SLOTS, PARTY_ENTITY_SLOT } from '../constants'
import { buildCollisionBox, DisembarkRule } from '../disembarkUtils'
import { DrivingProfile } from '../drivingUtils'
import { CAR_GROUND, GARDEN_GROUND, stepGardenHoverHeight } from '../groundProfiles'
import { GroundProfile } from '../groundStep'
import { convertMapXToEntityX, convertMapZToEntityY, psxXToWorld, psxZToWorld } from '../playerUtils'
import { readShipPose, ShipPose, writeShipPose } from '../shipPose'
import { getGroundVehicleState, setGroundVehicleState } from './groundVehicleState'

export type GroundVehicle = {
  disembarkDistance: number
  driving: DrivingProfile
  entitySlots: readonly number[]
  ground: GroundProfile
  leaveBit: number
  slideDriftShift: number
  stepHeight: (currentPsxY: number, triangle: TerrainTriangle) => number
}

const CAR: GroundVehicle = {
  disembarkDistance: CAR_DISEMBARK_DISTANCE,
  driving: CAR_DRIVING,
  entitySlots: [CAR_ENTITY_SLOT],
  ground: CAR_GROUND,
  leaveBit: CAR_LEAVE_BIT,
  slideDriftShift: CAR_SLIDE_DRIFT_SHIFT,
  stepHeight: (_currentPsxY, triangle) => getOnFootPsxHeight(triangle),
}

const GARDEN: GroundVehicle = {
  disembarkDistance: GARDEN_DISEMBARK_DISTANCE,
  driving: GARDEN_DRIVING,
  entitySlots: GARDEN_ENTITY_SLOTS,
  ground: GARDEN_GROUND,
  leaveBit: GARDEN_LEAVE_BIT,
  slideDriftShift: GARDEN_SLIDE_DRIFT_SHIFT,
  stepHeight: stepGardenHoverHeight,
}

const _probePosition = new Vector3()

export const getGroundVehicle = (vehicleId: number) => {
  if (isCarClass(vehicleId)) {
    return CAR
  }
  return vehicleId === VEHICLE_IDS.BALAMB_GARDEN ? GARDEN : undefined
}

const getReservedIndex = (slot: number) => WORLDMAP_STATE.reservedSlots[slot] ?? -1

const getVehicleEntityIndices = (vehicle: GroundVehicle) =>
  vehicle.entitySlots.map(getReservedIndex).filter((index) => index >= 0)

export const getVehicleAnchorEntity = (vehicle: GroundVehicle) => getEntity(getVehicleEntityIndices(vehicle)[0] ?? -1)

const getExcludedIndices = (vehicle: GroundVehicle) => [
  getReservedIndex(PARTY_ENTITY_SLOT),
  ...getVehicleEntityIndices(vehicle),
]

export const isStepBlockedByEntity = (vehicle: GroundVehicle, x: number, z: number, altitude: number) => {
  const pose = { ...readShipPose(_probePosition.set(x, 0, z)), altitude }
  const height = getEntityFootprintHeight(getVehicleAnchorEntity(vehicle)?.typeCode ?? -1)
  return (
    findCollidingEntity(getAllEntities(), {
      box: buildCollisionBox(pose, vehicle.ground.probeOffsetPsx, height),
      excludedIndices: getExcludedIndices(vehicle),
      isHeightIgnored: false,
      reach: 0,
    }) >= 0 || isStepBlockedByTrain(x, psxHeightToWorldY(altitude), z)
  )
}

export const buildDisembarkRule = (vehicle: GroundVehicle): DisembarkRule => ({
  canLeaveFrom: (triangle) => hasAccessBit(triangle, vehicle.leaveBit),
  distance: vehicle.disembarkDistance,
  excludedIndices: getExcludedIndices(vehicle),
})

const placeEntity = (entity: EntityRecord, pose: ShipPose, yaw: number): EntityRecord => ({
  ...entity,
  positionVerticalY: pose.altitude,
  positionX: convertMapXToEntityX(pose.x),
  positionY: convertMapZToEntityY(pose.z),
  yaw,
})

export const parkVehicle = (vehicle: GroundVehicle, pose: ShipPose, yaw: number) => {
  getVehicleEntityIndices(vehicle).forEach((index) => {
    const entity = getEntity(index)
    if (entity) {
      replaceEntity(index, placeEntity(entity, pose, yaw))
    }
  })
}

export const writeEntityPosition = (position: Vector3, entity: EntityRecord) => {
  position.set(
    psxXToWorld(entity.positionX),
    psxHeightToWorldY(entity.positionVerticalY),
    psxZToWorld(entity.positionY),
  )
}

export const finishDisembark = (spot: ShipPose) => {
  const position = useGlobalStore.getState().characterPosition
  if (position) {
    writeShipPose(position, spot)
  }
  const { restoredVehicleId } = getGroundVehicleState()
  setGroundVehicleState({ ...getGroundVehicleState(), landing: null, velocity: 0 })
  useWorldmapStore.setState({
    cameraModeIndex: 0,
    vehicleId: restoredVehicleId,
    worldMapState: WORLD_MAP_STATE_FREE_ROAM,
  })
}
