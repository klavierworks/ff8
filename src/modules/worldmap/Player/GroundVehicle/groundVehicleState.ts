import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { SlideSet } from '../groundStep'
import { ShipPose } from '../shipPose'

export type GardenLanding = {
  altitudeStep: number
  elapsedTicks: number
  spot: ShipPose
}

export type GroundVehicleState = {
  blockedTicks: number
  landing: GardenLanding | null
  preferredSet: SlideSet
  restoredVehicleId: number
  slideAnglePsx: number
  velocity: number
}

const INITIAL_STATE: GroundVehicleState = {
  blockedTicks: 0,
  landing: null,
  preferredSet: 0,
  restoredVehicleId: VEHICLE_IDS.ON_FOOT,
  slideAnglePsx: 0,
  velocity: 0,
}

let state = INITIAL_STATE

export const getGroundVehicleState = () => state

export const setGroundVehicleState = (next: GroundVehicleState) => {
  state = next
}

export const startGroundVehicleTrip = (restoredVehicleId: number) => {
  state = { ...INITIAL_STATE, restoredVehicleId }
}

export const resetGroundVehicleState = () => {
  state = INITIAL_STATE
}
