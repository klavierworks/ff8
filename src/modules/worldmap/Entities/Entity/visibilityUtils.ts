import { getCategoryForEntity } from './categoryUtils'

export const isVisibleInCurrentVehicle = (typeCode: number, vehicleId: number): boolean => {
  const VEHICLE_ON_FOOT = 128
  const VEHICLE_CACTUAR = 49
  const category = getCategoryForEntity(typeCode)
  if (category === undefined) {
    return true
  }
  if (category < 10 || category === VEHICLE_ON_FOOT) {
    return vehicleId < 10 || vehicleId === VEHICLE_ON_FOOT || vehicleId === VEHICLE_CACTUAR
  }
  if (category === VEHICLE_CACTUAR) {
    return vehicleId === VEHICLE_CACTUAR
  }
  return true
}
