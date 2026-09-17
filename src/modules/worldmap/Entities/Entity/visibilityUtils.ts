import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { isOnFootClass, isWalkerClass } from '../../vehicleClasses'
import { getEntityVehicleCategory } from '../../vehicleEntities'

export const isVisibleInCurrentVehicle = (typeCode: number, vehicleId: number) => {
  const category = getEntityVehicleCategory(typeCode)
  if (category === undefined) {
    return true
  }
  if (isOnFootClass(category)) {
    return isWalkerClass(vehicleId)
  }
  if (category === VEHICLE_IDS.CACTUAR) {
    return vehicleId === VEHICLE_IDS.CACTUAR
  }
  return true
}
