import { PsxVector, RandomByte, SPAWN_JITTER_LIFETIME, SPAWN_JITTER_SCALE } from './effectPool'

export type EffectPose = {
  position: PsxVector
  rotation: PsxVector
}

export type EmitterInput = {
  boatWakePose: EffectPose | undefined
  forceFieldFlashYaw: number | undefined
  groundType: number | undefined
  groundY: number | undefined
  position: PsxVector
  runFrameUnits: number | undefined
  speed: number
  vehicleId: number
  worldMapState: number
  yaw: number
}

export type SpawnEffect = (effectId: number, position: PsxVector, rotation: PsxVector, flags: number) => void

export const FULL_JITTER = SPAWN_JITTER_LIFETIME | SPAWN_JITTER_SCALE

export const EFFECT_SPLASH_DROPLET = 2
export const EFFECT_WATER_SPRAY = 19

export const WATER_GROUND_TYPE = 8
export const SPRAY_YAW_OFFSET = 800
export const WATER_SPRAY_MAX_HEIGHT = 600

const CANOPY_GROUND_TYPE_MIN = 0x1e
const CANOPY_GROUND_TYPE_MAX = 0x22
const SHALLOW_WATER_GROUND_TYPE_MIN = 0x0a
const SHALLOW_WATER_GROUND_TYPE_MAX = 0x0b

const SPLASH_DROPLET_COUNT = 8
const SPLASH_YAW_STEP_SHIFT = 9
const WIDE_YAW_JITTER_FACTOR = 8
const WIDE_YAW_JITTER_CENTER = 1024
const ROLL_JITTER_FACTOR = 4
const ROLL_JITTER_CENTER = 512

const WORD_SIGN_BIT = 0x8000
const WORD_RANGE = 0x10000

export const toSignedWord = (value: number) => {
  const word = value & (WORD_RANGE - 1)
  return word >= WORD_SIGN_BIT ? word - WORD_RANGE : word
}

export const getIsCanopyOrShallowWater = (groundType: number) =>
  (groundType >= CANOPY_GROUND_TYPE_MIN && groundType <= CANOPY_GROUND_TYPE_MAX) ||
  (groundType >= SHALLOW_WATER_GROUND_TYPE_MIN && groundType <= SHALLOW_WATER_GROUND_TYPE_MAX)

export const getWideJitteredYaw = (baseYaw: number, yawOffset: number, random: RandomByte) =>
  baseYaw + yawOffset + WIDE_YAW_JITTER_FACTOR * random() - WIDE_YAW_JITTER_CENTER

export const getWideJitteredRotation = (base: PsxVector, yawOffset: number, random: RandomByte): PsxVector => ({
  x: base.x,
  y: getWideJitteredYaw(base.y, yawOffset, random),
  z: base.z + ROLL_JITTER_FACTOR * random() - ROLL_JITTER_CENTER,
})

// The yaw and roll accumulate across the burst rather than restarting per droplet.
export const emitSplashBurst = (spawn: SpawnEffect, position: PsxVector, random: RandomByte) => {
  const rotation = { x: 0, y: 0, z: 0 }
  for (let droplet = 0; droplet < SPLASH_DROPLET_COUNT; droplet += 1) {
    rotation.y = toSignedWord(rotation.y + (droplet << SPLASH_YAW_STEP_SHIFT))
    rotation.y = toSignedWord(rotation.y + WIDE_YAW_JITTER_FACTOR * random() - WIDE_YAW_JITTER_CENTER)
    rotation.z = toSignedWord(rotation.z + ROLL_JITTER_FACTOR * random() - ROLL_JITTER_CENTER)
    spawn(EFFECT_SPLASH_DROPLET, position, rotation, FULL_JITTER)
  }
}

export const emitSprayPair = (
  spawn: SpawnEffect,
  effectId: number,
  position: PsxVector,
  getRotation: (yawOffset: number) => PsxVector,
) => {
  spawn(effectId, position, getRotation(SPRAY_YAW_OFFSET), FULL_JITTER)
  spawn(effectId, position, getRotation(-SPRAY_YAW_OFFSET), FULL_JITTER)
}

export const emitWaterSpray = (spawn: SpawnEffect, input: EmitterInput, groundY: number, random: RandomByte) => {
  const { position, speed, yaw } = input
  const height = toSignedWord(groundY - position.y)
  const isSprayRolled = speed > (height >> 2) + random() && Math.abs(height) < WATER_SPRAY_MAX_HEIGHT
  if (isSprayRolled) {
    emitSprayPair(spawn, EFFECT_WATER_SPRAY, { ...position, y: groundY }, (yawOffset) =>
      getWideJitteredRotation({ x: 0, y: yaw, z: 0 }, yawOffset, random),
    )
  }
}
