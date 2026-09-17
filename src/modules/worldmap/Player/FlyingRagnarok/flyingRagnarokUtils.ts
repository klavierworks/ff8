import { Group, Vector3 } from 'three'

import { VEHICLE_IDS } from '../../../../constants/vehicles'
import useGlobalStore from '../../../../store'
import { PSX_ANGLE_TO_RAD } from '../../constants'
import { calculateCurvedEntityY } from '../../curvature'
import { EntityRecord } from '../../Scripts/state'
import { psxHeightToWorldY } from '../../terrain'
import useWorldmapStore from '../../worldmapStore'
import { convertHeadingToFieldDirection } from '../playerAngles'
import { psxXToWorld, psxZToWorld } from '../playerUtils'
import { getRagnarokEntity } from './ragnarokEntity'
import { getRagnarokOutputs } from './ragnarokState'

const _parkedPosition = new Vector3()

const placeParkedShip = (outerGroup: Group, entity: EntityRecord) => {
  _parkedPosition.set(
    psxXToWorld(entity.positionX),
    psxHeightToWorldY(entity.positionVerticalY),
    psxZToWorld(entity.positionY),
  )
  _parkedPosition.y = calculateCurvedEntityY(_parkedPosition)
  outerGroup.position.copy(_parkedPosition)
  outerGroup.rotation.y = convertHeadingToFieldDirection(entity.yaw) * PSX_ANGLE_TO_RAD
}

const placePilotedShip = (outerGroup: Group, position: Vector3) => {
  outerGroup.position.copy(position)
  outerGroup.rotation.y = useGlobalStore.getState().fieldDirection * PSX_ANGLE_TO_RAD
}

export const placeShipGroups = (outerGroup: Group, bankGroup: Group) => {
  const position = useGlobalStore.getState().characterPosition
  const isAboard = useWorldmapStore.getState().vehicleId === VEHICLE_IDS.RAGNAROK
  const parkedShip = isAboard ? undefined : getRagnarokEntity()
  outerGroup.visible = isAboard ? !!position : !!parkedShip
  bankGroup.rotation.z = isAboard ? getRagnarokOutputs().bank * PSX_ANGLE_TO_RAD : 0
  if (isAboard && position) {
    placePilotedShip(outerGroup, position)
    return
  }
  if (parkedShip) {
    placeParkedShip(outerGroup, parkedShip)
  }
}
