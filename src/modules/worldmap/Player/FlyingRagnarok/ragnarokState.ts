import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { ShipPose } from '../shipPose'

type RagnarokOutputs = {
  animationFrame: number
  bank: number
  velocity: number
}

type RagnarokTrip = {
  landingSpot: null | ShipPose
  restoredVehicleId: number
}

const INITIAL_OUTPUTS: RagnarokOutputs = {
  animationFrame: 0,
  bank: 0,
  velocity: 0,
}

const INITIAL_TRIP: RagnarokTrip = {
  landingSpot: null,
  restoredVehicleId: VEHICLE_IDS.ON_FOOT,
}

let outputs = INITIAL_OUTPUTS

let trip = INITIAL_TRIP

export const getRagnarokOutputs = () => outputs

export const setRagnarokOutputs = (next: RagnarokOutputs) => {
  outputs = next
}

export const getRagnarokTrip = () => trip

export const setRagnarokTrip = (next: RagnarokTrip) => {
  trip = next
}

export const resetRagnarokState = () => {
  outputs = INITIAL_OUTPUTS
  trip = INITIAL_TRIP
}
