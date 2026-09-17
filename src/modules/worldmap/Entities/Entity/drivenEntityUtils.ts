import { Group } from 'three'

import {
  ENTITY_SPIN_YAW_PER_FRAME,
  FORCE_FIELD_ENTITY_TYPE,
  ROLLING_ENTITY_SUBTYPE,
  SPINNING_ENTITY_SUBTYPE,
} from '../../../../constants/worldmapEntities'
import useGlobalStore from '../../../../store'
import { getScriptFrame } from '../../../field/scriptClock'
import { convertFieldDirectionToHeading, wrapPsxAngle } from '../../Player/playerAngles'
import { EntityRecord } from '../../Scripts/state'
import { isDrivenVehicleEntity } from '../../vehicleEntities'
import useWorldmapStore from '../../worldmapStore'

export const isEntityDriven = (entity: EntityRecord) =>
  isDrivenVehicleEntity(entity.typeCode, useWorldmapStore.getState().vehicleId)

export const placeDrivenEntity = (group: Group) => {
  const { characterPosition } = useGlobalStore.getState()
  if (characterPosition) {
    group.position.copy(characterPosition)
  }
}

// The rolling subtype wins over the force field's type code, so a rolling force field keeps its yaw.
const isSpinningEntity = (entity: EntityRecord) =>
  entity.subType !== ROLLING_ENTITY_SUBTYPE &&
  (entity.typeCode === FORCE_FIELD_ENTITY_TYPE || entity.subType === SPINNING_ENTITY_SUBTYPE)

const calculateSpinYaw = () => wrapPsxAngle(ENTITY_SPIN_YAW_PER_FRAME * getScriptFrame())

const getDrivenYaw = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

export const getCurrentEntityYaw = (entity: EntityRecord) => {
  if (isSpinningEntity(entity)) {
    return calculateSpinYaw()
  }
  return isEntityDriven(entity) ? getDrivenYaw() : entity.yaw
}
