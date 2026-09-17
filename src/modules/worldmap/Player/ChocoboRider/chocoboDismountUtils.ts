import { Object3D, Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import {
  CHOCOBO_DISMOUNT_DISTANCE,
  CHOCOBO_DISMOUNT_FRAME_MAX,
  CHOCOBO_DISMOUNT_FRAME_STEP,
  CHOCOBO_DISMOUNT_SIDE_ANGLE,
  CHOCOBO_DISMOUNT_SIDE_DISTANCE,
  CHOCOBO_LEAVE_BIT,
} from '../../../../constants/worldmapVehicles'
import { getEntity, WORLDMAP_STATE } from '../../Scripts/state'
import { hasAccessBit } from '../../terrain'
import { getEntityVehicleCategory } from '../../vehicleEntities'
import { PARTY_ENTITY_SLOT } from '../constants'
import { findDisembarkSpot } from '../disembarkUtils'
import { calculateHeadingStep } from '../drivingUtils'
import { wrapPsxAngle } from '../playerAngles'
import { findTopTriangle, readShipPose, ShipPose } from '../shipPose'
import { ChocoboPose } from './runOffUtils'

const getPartyEntityIndex = () => WORLDMAP_STATE.reservedSlots[PARTY_ENTITY_SLOT]

const isDismountSideClear = (scene: Object3D, spot: ShipPose, heading: number) => {
  const step = calculateHeadingStep(CHOCOBO_DISMOUNT_SIDE_DISTANCE, wrapPsxAngle(heading + CHOCOBO_DISMOUNT_SIDE_ANGLE))
  const triangle = findTopTriangle(scene, spot.x + step.x, spot.z + step.z)
  console.log('[dismount-debug] side check', {
    access: triangle?.accessFlags.toString(16),
    canLeave: triangle !== undefined && hasAccessBit(triangle, CHOCOBO_LEAVE_BIT),
    heading,
    step,
  })
  return triangle !== undefined && hasAccessBit(triangle, CHOCOBO_LEAVE_BIT)
}

export const findChocoboDismountSpot = (scene: Object3D, pose: ShipPose, heading: number) => {
  const spot = findDisembarkSpot(scene, pose, heading, {
    canLeaveFrom: (triangle) => hasAccessBit(triangle, CHOCOBO_LEAVE_BIT),
    distance: CHOCOBO_DISMOUNT_DISTANCE,
    excludedIndices: [getPartyEntityIndex()],
  })
  return spot && isDismountSideClear(scene, spot, heading) ? spot : undefined
}

export const buildChocoboPose = (position: Vector3, heading: number): ChocoboPose => ({
  ...readShipPose(position),
  heading,
  triangle: WORLDMAP_STATE.locationTriangle,
})

export const stepDismountFrame = (frame: number) =>
  Math.min(frame + CHOCOBO_DISMOUNT_FRAME_STEP, CHOCOBO_DISMOUNT_FRAME_MAX)

export const getPartyVehicleId = () => {
  const party = getEntity(getPartyEntityIndex())
  return (party && getEntityVehicleCategory(party.typeCode)) ?? VEHICLE_IDS.ON_FOOT
}
