import { VEHICLE_IDS } from '../../constants/vehicles'
import {
  COMPANION_ENTITY_TYPES,
  ENTITY_VEHICLE_CATEGORIES,
  GARDEN_ENTITY_TYPES,
  RAGNAROK_ENTITY_TYPE,
} from '../../constants/worldmapEntities'
import { isCarClass } from './vehicleClasses'

const CATEGORY_BY_TYPE_CODE: ReadonlyMap<number, number> = new Map(
  ENTITY_VEHICLE_CATEGORIES.flatMap(({ category, typeCodes }) =>
    typeCodes.map((typeCode) => [typeCode, category] as const),
  ),
)

export const getEntityVehicleCategory = (typeCode: number) => CATEGORY_BY_TYPE_CODE.get(typeCode)

export const isCompanionEntityType = (typeCode: number) =>
  (COMPANION_ENTITY_TYPES as readonly number[]).includes(typeCode)

export const isGardenEntityType = (typeCode: number) => (GARDEN_ENTITY_TYPES as readonly number[]).includes(typeCode)

export const isCarEntityType = (typeCode: number) => {
  const category = getEntityVehicleCategory(typeCode)
  return category !== undefined && isCarClass(category)
}

export const getCarEntityType = (vehicleId: number) =>
  ENTITY_VEHICLE_CATEGORIES.find(({ category }) => category === vehicleId)?.typeCodes[0]

export const getBoardableVehicleId = (typeCode: number) => {
  if (isGardenEntityType(typeCode)) {
    return VEHICLE_IDS.BALAMB_GARDEN
  }
  return isCarEntityType(typeCode) ? getEntityVehicleCategory(typeCode) : undefined
}

export const isDrivenVehicleEntity = (typeCode: number, vehicleId: number) =>
  getBoardableVehicleId(typeCode) === vehicleId

export const getVehicleEntityType = (vehicleId: number) => {
  if (vehicleId === VEHICLE_IDS.RAGNAROK) {
    return RAGNAROK_ENTITY_TYPE
  }
  if (vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    return GARDEN_ENTITY_TYPES[0]
  }
  return getCarEntityType(vehicleId) ?? 0
}
