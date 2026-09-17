import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { ENTITY_VEHICLE_CATEGORIES } from '../../../../constants/worldmapEntities'
import { isOnFootClass, isWalkerClass } from '../../vehicleClasses'

const CATEGORY_BY_TYPE_CODE: ReadonlyMap<number, number> = new Map(
  ENTITY_VEHICLE_CATEGORIES.flatMap(({ category, typeCodes }) =>
    typeCodes.map((typeCode) => [typeCode, category] as const),
  ),
)

export const isVisibleInCurrentVehicle = (typeCode: number, vehicleId: number) => {
  const category = CATEGORY_BY_TYPE_CODE.get(typeCode)
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
