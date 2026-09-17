import { RAGNAROK_ENTITY_TYPE } from '../../../../constants/worldmapEntities'
import { addEntity, EntityRecord, getEntity, replaceEntity, WORLDMAP_STATE } from '../../Scripts/state'
import { convertEntityXToMapX, convertEntityYToMapZ, convertMapXToEntityX, convertMapZToEntityY } from '../playerUtils'
import { ShipPose, wrapMapX, wrapMapZ } from './shipPose'

const PARTY_SLOT = 0
const RAGNAROK_SLOT = 3

export const getPartyEntityIndex = () => WORLDMAP_STATE.reservedSlots[PARTY_SLOT]

export const getRagnarokEntityIndex = () => WORLDMAP_STATE.reservedSlots[RAGNAROK_SLOT]

export const getRagnarokEntity = () => getEntity(getRagnarokEntityIndex())

const buildRagnarokEntity = (pose: ShipPose, shipYaw: number): EntityRecord => ({
  pitch: 0,
  positionVerticalY: pose.altitude,
  positionX: convertMapXToEntityX(pose.x),
  positionY: convertMapZToEntityY(pose.z),
  subType: 0,
  typeCode: RAGNAROK_ENTITY_TYPE,
  yaw: shipYaw,
})

export const readRagnarokEntityPose = (entity: EntityRecord): ShipPose => ({
  altitude: entity.positionVerticalY,
  x: wrapMapX(convertEntityXToMapX(entity.positionX)),
  z: wrapMapZ(convertEntityYToMapZ(entity.positionY)),
})

export const storeRagnarokPose = (pose: ShipPose, shipYaw: number) => {
  const index = getRagnarokEntityIndex()
  if (index < 0) {
    return
  }
  replaceEntity(index, buildRagnarokEntity(pose, shipYaw))
}

export const placeRagnarokEntity = (pose: ShipPose, shipYaw: number) => {
  if (getRagnarokEntityIndex() < 0) {
    addEntity(buildRagnarokEntity(pose, shipYaw))
    return
  }
  storeRagnarokPose(pose, shipYaw)
}
