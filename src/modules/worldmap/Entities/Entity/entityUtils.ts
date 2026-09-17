import { Object3D } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import {
  CAR_MODEL_YAW_OFFSET,
  GARDEN_MODEL_YAW_OFFSET,
  MODEL_YAW_OFFSETS_BY_TYPE,
} from '../../../../constants/worldmapEntities'
import { PSX_ANGLE_TO_RAD } from '../../constants'
import { wrapPsxAngle } from '../../Player/playerAngles'
import { EntityRecord } from '../../Scripts/state'
import { psxHeightToWorldY, queryTerrain, selectTopTriangle } from '../../terrain'
import { isCarClass } from '../../vehicleClasses'
import { getEntityVehicleCategory } from '../../vehicleEntities'
import { ModelReference } from './modelUtils'

export const findGroundWorldY = (scene: Object3D, worldX: number, worldZ: number) =>
  selectTopTriangle(queryTerrain(scene, worldX, worldZ))?.worldY

export const getFallbackWorldY = (entity: EntityRecord) => psxHeightToWorldY(entity.positionVerticalY)

const getWmsetYawOffset = (typeCode: number) => {
  const category = getEntityVehicleCategory(typeCode)
  if (category !== undefined && isCarClass(category)) {
    return CAR_MODEL_YAW_OFFSET
  }
  if (category === VEHICLE_IDS.BALAMB_GARDEN) {
    return GARDEN_MODEL_YAW_OFFSET
  }
  return MODEL_YAW_OFFSETS_BY_TYPE.get(typeCode) ?? 0
}

// The game's yaw matrix turns the opposite way to three.js, so wmset models negate the angle.
export const calculateModelYaw = (typeCode: number, yawPsx: number, model: ModelReference | undefined) =>
  model?.kind === 'wmset'
    ? -wrapPsxAngle(yawPsx + getWmsetYawOffset(typeCode)) * PSX_ANGLE_TO_RAD
    : yawPsx * PSX_ANGLE_TO_RAD

export const getEntityRotation = (
  entity: EntityRecord,
  model: ModelReference | undefined,
): [number, number, number] => [
  entity.pitch * PSX_ANGLE_TO_RAD,
  calculateModelYaw(entity.typeCode, entity.yaw, model),
  0,
]
