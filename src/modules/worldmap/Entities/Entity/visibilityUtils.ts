import { isOnFootClass, isWalkerClass } from '../../vehicleClasses'
import { getEntityVehicleCategory } from '../../vehicleEntities'

export const isVisibleInCurrentVehicle = (typeCode: number, vehicleId: number) => {
  const category = getEntityVehicleCategory(typeCode)
  if (category === undefined) {
    return true
  }
  return isOnFootClass(category) ? isWalkerClass(vehicleId) : true
}
