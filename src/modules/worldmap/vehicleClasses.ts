import {
  VEHICLE_IDS,
  WORLDMAP_ON_FOOT_CLASS_LIMIT,
  WORLDMAP_TRAIN_MAX,
  WORLDMAP_TRAIN_MIN,
} from '../../constants/vehicles'

export const isVehicleInRange = (vehicleId: number, min: number, max: number) => vehicleId >= min && vehicleId <= max

export const isOnFootClass = (vehicleId: number) =>
  vehicleId < WORLDMAP_ON_FOOT_CLASS_LIMIT || vehicleId === VEHICLE_IDS.ON_FOOT

export const isChocobo = (vehicleId: number) => vehicleId === VEHICLE_IDS.CHOCOBO

export const isWalkerClass = (vehicleId: number) => isOnFootClass(vehicleId) || isChocobo(vehicleId)

export const isTrainClass = (vehicleId: number) => isVehicleInRange(vehicleId, WORLDMAP_TRAIN_MIN, WORLDMAP_TRAIN_MAX)

export const isCarClass = (vehicleId: number) =>
  isVehicleInRange(vehicleId, VEHICLE_IDS.CAR_CLASS_MIN, VEHICLE_IDS.CAR_CLASS_MAX) ||
  vehicleId === VEHICLE_IDS.CAR_SPECIAL

export const isCarOrGarden = (vehicleId: number) => isCarClass(vehicleId) || vehicleId === VEHICLE_IDS.BALAMB_GARDEN

export const isBoatClass = (vehicleId: number) =>
  isVehicleInRange(vehicleId, VEHICLE_IDS.BOAT_DEFAULT, VEHICLE_IDS.BOAT_FOLLOWING)

export const isRagnarok = (vehicleId: number) => vehicleId === VEHICLE_IDS.RAGNAROK

export const isSteeredVehicle = (vehicleId: number) => isCarOrGarden(vehicleId) || isRagnarok(vehicleId)
