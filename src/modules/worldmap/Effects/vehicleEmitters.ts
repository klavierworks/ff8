import { VEHICLE_IDS } from '../../../constants/vehicles'
import { isBoatClass, isCarClass } from '../vehicleClasses'
import { RandomByte } from './effectPool'
import {
  emitSplashBurst,
  emitSprayPair,
  EmitterInput,
  emitWaterSpray,
  FULL_JITTER,
  getIsCanopyOrShallowWater,
  getWideJitteredRotation,
  SpawnEffect,
  WATER_GROUND_TYPE,
} from './emitterUtils'

const EFFECT_BOAT_WAKE = 0
const EFFECT_CAR_DUST = 3
const EFFECT_GARDEN_CANOPY_SPRAY = 10
const EFFECT_CAR_WATER_SPRAY = 14

const CAR_WATER_SPRAY_SPEED_FACTOR = 2
const CAR_DUST_SPEED_FACTOR = 4
const CAR_DUSTLESS_GROUND_TYPES: ReadonlySet<number> = new Set([27, 28])
const DUSTLESS_CAR_VEHICLE_IDS: ReadonlySet<number> = new Set([39, 40])

const GARDEN_CANOPY_SPEED_FACTOR = 2
const GARDEN_CANOPY_BASE_CHANCE = 128
const GARDEN_CANOPY_YAW_JITTER_FACTOR = 16
const RANDOM_BYTE_CENTER = 128

const BOAT_WAKE_YAW_JITTER_FACTOR = 4

const emitCarGroundEffects = (spawn: SpawnEffect, input: EmitterInput, groundType: number, random: RandomByte) => {
  const { position, speed, vehicleId, yaw } = input
  const getWideRotation = (yawOffset: number) => getWideJitteredRotation({ x: 0, y: yaw, z: 0 }, yawOffset, random)

  if (groundType === WATER_GROUND_TYPE) {
    if (CAR_WATER_SPRAY_SPEED_FACTOR * speed > random()) {
      emitSprayPair(spawn, EFFECT_CAR_WATER_SPRAY, position, getWideRotation)
    }
    return
  }
  if (getIsCanopyOrShallowWater(groundType)) {
    if (speed !== 0) {
      emitSplashBurst(spawn, position, random)
    }
    return
  }
  const isDustyGround = !CAR_DUSTLESS_GROUND_TYPES.has(groundType) && !DUSTLESS_CAR_VEHICLE_IDS.has(vehicleId)
  if (isDustyGround && CAR_DUST_SPEED_FACTOR * speed > random()) {
    emitSprayPair(spawn, EFFECT_CAR_DUST, position, getWideRotation)
  }
}

// The engine draws one more random byte after the spray whose value is never used.
const emitGardenCanopySpray = (spawn: SpawnEffect, input: EmitterInput, groundY: number, random: RandomByte) => {
  const { position, speed, yaw } = input
  const heightAboveGround = Math.min(position.y - groundY, 0)
  if (heightAboveGround + GARDEN_CANOPY_SPEED_FACTOR * speed + GARDEN_CANOPY_BASE_CHANCE <= random()) {
    return
  }
  const rotation = { x: 0, y: yaw + GARDEN_CANOPY_YAW_JITTER_FACTOR * (random() - RANDOM_BYTE_CENTER), z: 0 }
  spawn(EFFECT_GARDEN_CANOPY_SPRAY, { ...position, y: groundY }, rotation, FULL_JITTER)
  random()
}

const emitGardenGroundEffects = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  const { groundType, groundY } = input
  if (groundType === undefined || groundY === undefined) {
    return
  }
  if (groundType === WATER_GROUND_TYPE) {
    emitWaterSpray(spawn, input, groundY, random)
    return
  }
  if (getIsCanopyOrShallowWater(groundType)) {
    emitGardenCanopySpray(spawn, input, groundY, random)
  }
}

// The wake pose is mirrored into the port's axes, so the engine's yaw jitter is subtracted.
const emitBoatWake = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  const pose = input.boatWakePose
  if (!pose) {
    return
  }
  const { position, rotation } = pose
  spawn(
    EFFECT_BOAT_WAKE,
    position,
    { ...rotation, y: rotation.y - BOAT_WAKE_YAW_JITTER_FACTOR * random() },
    FULL_JITTER,
  )
  spawn(
    EFFECT_BOAT_WAKE,
    position,
    { ...rotation, y: rotation.y + BOAT_WAKE_YAW_JITTER_FACTOR * random() },
    FULL_JITTER,
  )
}

export const emitVehicleEffects = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  const { groundType, vehicleId } = input
  if (isCarClass(vehicleId) && groundType !== undefined) {
    emitCarGroundEffects(spawn, input, groundType, random)
  }
  if (vehicleId === VEHICLE_IDS.BALAMB_GARDEN) {
    emitGardenGroundEffects(spawn, input, random)
  }
  if (isBoatClass(vehicleId)) {
    emitBoatWake(spawn, input, random)
  }
}
