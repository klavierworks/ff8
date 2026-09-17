import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { ShipPose } from './shipPose'

type RagnarokOutputs = {
  animationFrame: number
  bank: number
  velocity: number
}

type RagnarokTrip = {
  landingSpot: null | ShipPose
  restoredVehicleId: number
}

let outputs: RagnarokOutputs = {
  animationFrame: 0,
  bank: 0,
  velocity: 0,
}

let trip: RagnarokTrip = {
  landingSpot: null,
  restoredVehicleId: VEHICLE_IDS.ON_FOOT,
}

export const getRagnarokOutputs = () => outputs

export const setRagnarokOutputs = (next: RagnarokOutputs) => {
  outputs = next
}

export const getRagnarokTrip = () => trip

export const setRagnarokTrip = (next: RagnarokTrip) => {
  trip = next
}
