import { Object3D } from 'three'

import { PSX_ANGLE_TO_RAD } from '../../constants'
import { EntityRecord } from '../../Scripts/state'
import { psxHeightToWorldY, queryTerrain, selectTopTriangle } from '../../terrain'

export const findGroundWorldY = (scene: Object3D, worldX: number, worldZ: number) =>
  selectTopTriangle(queryTerrain(scene, worldX, worldZ))?.worldY

export const getFallbackWorldY = (entity: EntityRecord) => psxHeightToWorldY(entity.positionVerticalY)

export const getEntityRotation = (entity: EntityRecord): [number, number, number] => [
  entity.pitch * PSX_ANGLE_TO_RAD,
  entity.yaw * PSX_ANGLE_TO_RAD,
  0,
]
