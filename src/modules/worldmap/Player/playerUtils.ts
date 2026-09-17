import { MathUtils, Vector3 } from 'three'

import { WORLD_DEPTH_PSX, WORLD_WIDTH_PSX, WORLDMAP_SCALE } from '../constants'
import { WORLDMAP_STATE } from '../Scripts/state'
import { isGroundTypeCanopy, psxHeightToWorldY } from '../terrain'
import { FieldLandingPosition } from '../useSections'
import { SPAWN_YAW_SCALE } from './constants'
import { convertHeadingToFieldDirection } from './playerAngles'

const PSX_X_HALF_WORLD = WORLD_WIDTH_PSX / 2
const PSX_Z_HALF_WORLD = WORLD_DEPTH_PSX / 2

export const convertMapXToEntityX = (x: number) => x - PSX_X_HALF_WORLD
export const convertMapZToEntityY = (z: number) => z - PSX_Z_HALF_WORLD

export const convertEntityXToMapX = (x: number) => x + PSX_X_HALF_WORLD
export const convertEntityYToMapZ = (y: number) => y + PSX_Z_HALF_WORLD

export const psxXToWorld = (psxX: number) => convertEntityXToMapX(psxX) * WORLDMAP_SCALE
export const psxZToWorld = (psxZ: number) => convertEntityYToMapZ(psxZ) * WORLDMAP_SCALE

export const worldXToPsx = (worldX: number) =>
  convertMapXToEntityX(MathUtils.euclideanModulo(worldX / WORLDMAP_SCALE, WORLD_WIDTH_PSX))
export const worldZToPsx = (worldZ: number) =>
  convertMapZToEntityY(MathUtils.euclideanModulo(worldZ / WORLDMAP_SCALE, WORLD_DEPTH_PSX))

export const isOnCanopyGround = () => isGroundTypeCanopy(WORLDMAP_STATE.locationTriangle?.groundType)

export const createSpawnPosition = (landing: FieldLandingPosition) =>
  new Vector3(psxXToWorld(landing.x), psxHeightToWorldY(landing.z), psxZToWorld(landing.y))

export const getSpawnFieldDirection = (landing: FieldLandingPosition) =>
  convertHeadingToFieldDirection(landing.vehicle_yaw * SPAWN_YAW_SCALE)
