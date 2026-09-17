import { VEHICLE_IDS } from '../../../constants/vehicles'
import { WORLD_MAP_STATE_RAGNAROK_LANDING, WORLD_MAP_STATE_RAGNAROK_TAKEOFF } from '../worldmapStore'
import { PsxVector, RandomByte, rotatePsxVector, SPAWN_JITTER_LIFETIME, SPAWN_JITTER_SCALE } from './effectPool'

export type EmitterInput = {
  groundType: number | undefined
  groundY: number | undefined
  position: PsxVector
  runFrameUnits: number | undefined
  speed: number
  vehicleId: number
  worldMapState: number
  yaw: number
}

export type FootLatches = [boolean, boolean]

export type SpawnEffect = (effectId: number, position: PsxVector, rotation: PsxVector, flags: number) => void

const ON_FOOT_CLASS_LIMIT = 10
const FULL_JITTER = SPAWN_JITTER_LIFETIME | SPAWN_JITTER_SCALE

const EFFECT_SPLASH_DROPLET = 2
const EFFECT_FOREST_LEAVES_FIRST = 4
const EFFECT_RAGNAROK_EXHAUST_SPARK = 12
const EFFECT_RAGNAROK_EXHAUST_GLOW = 13
const EFFECT_RAGNAROK_CANOPY_SPRAY = 15
const EFFECT_FOOTPRINT = 16
const EFFECT_RAGNAROK_WATER_SPRAY = 19
const EFFECT_RAGNAROK_GROUND_DUST = 20

const FOREST_GROUND_TYPE_MAX = 5
const WATER_GROUND_TYPE = 8
const FOOTPRINT_GROUND_TYPES: ReadonlySet<number> = new Set([9, 11, 17])
const RAGNAROK_DUST_GROUND_TYPES: ReadonlySet<number> = new Set([9, 17])
const CANOPY_GROUND_TYPE_MIN = 0x1e
const CANOPY_GROUND_TYPE_MAX = 0x22
const SHALLOW_WATER_GROUND_TYPE_MIN = 0x0a
const SHALLOW_WATER_GROUND_TYPE_MAX = 0x0b

const FOOT_STRIKE_FRAME_UNITS = [272, 112]
const SPLASH_FRAME_UNITS = [304, 144]
const SPLASH_FRAME_TOLERANCE = 4
const SPLASH_DROPLET_COUNT = 8
const SPLASH_YAW_STEP_SHIFT = 9
const FOOTPRINT_YAW_OFFSET = 128

const FOREST_LEAVES_HEIGHT = 320
const LEAVES_SPEED_FACTOR = 8
const WIDE_YAW_JITTER_FACTOR = 8
const WIDE_YAW_JITTER_CENTER = 1024
const ROLL_JITTER_FACTOR = 4
const ROLL_JITTER_CENTER = 512
const NARROW_ROLL_JITTER_CENTER = 128

const RAGNAROK_SPRAY_YAW_OFFSET = 800
const RAGNAROK_WATER_SPRAY_MAX_HEIGHT = 600
const RAGNAROK_CANOPY_SPRAY_MAX_HEIGHT = 420
const RAGNAROK_EXHAUST_DROP = 146
const RAGNAROK_EXHAUST_OFFSETS: readonly PsxVector[] = [
  { x: 188, y: 108, z: -386 },
  { x: -188, y: 108, z: -386 },
]

const WORD_SIGN_BIT = 0x8000
const WORD_RANGE = 0x10000

const toSignedWord = (value: number) => {
  const word = value & (WORD_RANGE - 1)
  return word >= WORD_SIGN_BIT ? word - WORD_RANGE : word
}

const getIsOnFootClass = (vehicleId: number) => vehicleId < ON_FOOT_CLASS_LIMIT || vehicleId === VEHICLE_IDS.ON_FOOT

const getIsCanopyOrShallowWater = (groundType: number) =>
  (groundType >= CANOPY_GROUND_TYPE_MIN && groundType <= CANOPY_GROUND_TYPE_MAX) ||
  (groundType >= SHALLOW_WATER_GROUND_TYPE_MIN && groundType <= SHALLOW_WATER_GROUND_TYPE_MAX)

const getWideJitteredRotation = (base: PsxVector, yawOffset: number, random: RandomByte): PsxVector => ({
  x: base.x,
  y: base.y + yawOffset + WIDE_YAW_JITTER_FACTOR * random() - WIDE_YAW_JITTER_CENTER,
  z: base.z + ROLL_JITTER_FACTOR * random() - ROLL_JITTER_CENTER,
})

type FootStrike = {
  latches: FootLatches
  struckFoot: number
}

// Each foot re-arms once the run cycle drops below its strike frame, and strikes on the first
// frame at or past it.
const getFootStrike = (latches: FootLatches, frameUnits: number) =>
  FOOT_STRIKE_FRAME_UNITS.reduce<FootStrike>(
    (strike, strikeUnits, foot) => {
      const nextLatches: FootLatches = [...strike.latches]
      if (strikeUnits > frameUnits) {
        nextLatches[foot] = false
        return { ...strike, latches: nextLatches }
      }
      if (strike.latches[foot]) {
        return strike
      }
      nextLatches[foot] = true
      return { latches: nextLatches, struckFoot: foot }
    },
    { latches, struckFoot: -1 },
  )

const getIsSplashFrame = (frameUnits: number) =>
  SPLASH_FRAME_UNITS.some((units) => Math.abs(frameUnits - units) < SPLASH_FRAME_TOLERANCE)

// The yaw and roll accumulate across the burst rather than restarting per droplet.
const emitSplashBurst = (spawn: SpawnEffect, position: PsxVector, random: RandomByte) => {
  const rotation = { x: 0, y: 0, z: 0 }
  for (let droplet = 0; droplet < SPLASH_DROPLET_COUNT; droplet += 1) {
    rotation.y = toSignedWord(rotation.y + (droplet << SPLASH_YAW_STEP_SHIFT))
    rotation.y = toSignedWord(rotation.y + WIDE_YAW_JITTER_FACTOR * random() - WIDE_YAW_JITTER_CENTER)
    rotation.z = toSignedWord(rotation.z + ROLL_JITTER_FACTOR * random() - ROLL_JITTER_CENTER)
    spawn(EFFECT_SPLASH_DROPLET, position, rotation, FULL_JITTER)
  }
}

const emitRunCycleEffects = (
  spawn: SpawnEffect,
  input: EmitterInput,
  groundType: number,
  frameUnits: number,
  latches: FootLatches,
  random: RandomByte,
) => {
  const strike = getFootStrike(latches, frameUnits)
  const struckFoot = strike.struckFoot
  const baseRotation = { x: 0, y: input.yaw, z: 0 }
  if (struckFoot >= 0 && FOOTPRINT_GROUND_TYPES.has(groundType)) {
    const yawOffset = struckFoot === 0 ? -FOOTPRINT_YAW_OFFSET : FOOTPRINT_YAW_OFFSET
    spawn(EFFECT_FOOTPRINT, input.position, { ...baseRotation, y: baseRotation.y + yawOffset }, 0)
  }
  if (getIsSplashFrame(frameUnits) && getIsCanopyOrShallowWater(groundType)) {
    emitSplashBurst(spawn, input.position, random)
  }
  return strike.latches
}

const emitForestLeaves = (spawn: SpawnEffect, input: EmitterInput, groundType: number, random: RandomByte) => {
  if (groundType > FOREST_GROUND_TYPE_MAX || LEAVES_SPEED_FACTOR * input.speed <= random()) {
    return
  }
  const leavesPosition = { ...input.position, y: input.position.y - FOREST_LEAVES_HEIGHT }
  const rotation = getWideJitteredRotation({ x: 0, y: input.yaw, z: 0 }, 0, random)
  spawn(EFFECT_FOREST_LEAVES_FIRST + groundType, leavesPosition, rotation, FULL_JITTER)
}

const emitOnFootEffects = (spawn: SpawnEffect, input: EmitterInput, latches: FootLatches, random: RandomByte) => {
  const { groundType, runFrameUnits } = input
  if (groundType === undefined) {
    return latches
  }
  const nextLatches =
    runFrameUnits === undefined
      ? latches
      : emitRunCycleEffects(spawn, input, groundType, runFrameUnits, latches, random)
  emitForestLeaves(spawn, input, groundType, random)
  return nextLatches
}

const emitSprayPair = (
  spawn: SpawnEffect,
  effectId: number,
  position: PsxVector,
  getRotation: (yawOffset: number) => PsxVector,
) => {
  spawn(effectId, position, getRotation(RAGNAROK_SPRAY_YAW_OFFSET), FULL_JITTER)
  spawn(effectId, position, getRotation(-RAGNAROK_SPRAY_YAW_OFFSET), FULL_JITTER)
}

const emitRagnarokGroundEffects = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  const { groundType, groundY, position, speed, yaw } = input
  if (groundType === undefined || groundY === undefined) {
    return
  }
  const baseRotation = { x: 0, y: yaw, z: 0 }
  const groundPosition = { ...position, y: groundY }
  const height = toSignedWord(groundY - position.y)
  const getWideRotation = (yawOffset: number) => getWideJitteredRotation(baseRotation, yawOffset, random)

  if (groundType === WATER_GROUND_TYPE) {
    const isSprayRolled = speed > (height >> 2) + random() && Math.abs(height) < RAGNAROK_WATER_SPRAY_MAX_HEIGHT
    if (isSprayRolled) {
      emitSprayPair(spawn, EFFECT_RAGNAROK_WATER_SPRAY, groundPosition, getWideRotation)
    }
    return
  }

  if (getIsCanopyOrShallowWater(groundType)) {
    const isSprayRolled = speed > (height >> 2) + random() && Math.abs(height) < RAGNAROK_CANOPY_SPRAY_MAX_HEIGHT
    if (isSprayRolled) {
      emitSprayPair(spawn, EFFECT_RAGNAROK_CANOPY_SPRAY, groundPosition, (yawOffset) => ({
        x: baseRotation.x,
        y: baseRotation.y + yawOffset + WIDE_YAW_JITTER_FACTOR * random() - WIDE_YAW_JITTER_CENTER,
        z: baseRotation.z + random() - NARROW_ROLL_JITTER_CENTER,
      }))
    }
    return
  }

  const isDustRolled = speed >> 1 > ((groundY - position.y) >> 4) + random()
  if (RAGNAROK_DUST_GROUND_TYPES.has(groundType) && isDustRolled) {
    emitSprayPair(spawn, EFFECT_RAGNAROK_GROUND_DUST, groundPosition, getWideRotation)
  }
}

const emitRagnarokExhaust = (spawn: SpawnEffect, input: EmitterInput) => {
  const rotation = { x: 0, y: input.yaw, z: 0 }
  RAGNAROK_EXHAUST_OFFSETS.forEach((offset) => {
    const rotated = rotatePsxVector(offset, rotation)
    const exhaustPosition = {
      x: input.position.x + rotated.x,
      y: input.position.y - RAGNAROK_EXHAUST_DROP + rotated.y,
      z: input.position.z + rotated.z,
    }
    if (input.speed !== 0) {
      spawn(EFFECT_RAGNAROK_EXHAUST_SPARK, exhaustPosition, rotation, SPAWN_JITTER_SCALE)
    }
    spawn(EFFECT_RAGNAROK_EXHAUST_GLOW, exhaustPosition, rotation, SPAWN_JITTER_SCALE)
  })
}

const emitRagnarokEffects = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  emitRagnarokGroundEffects(spawn, input, random)
  const isTransitioning =
    input.worldMapState === WORLD_MAP_STATE_RAGNAROK_LANDING || input.worldMapState === WORLD_MAP_STATE_RAGNAROK_TAKEOFF
  if (!isTransitioning) {
    emitRagnarokExhaust(spawn, input)
  }
}

export const emitWorldmapEffects = (
  spawn: SpawnEffect,
  input: EmitterInput,
  latches: FootLatches,
  random: RandomByte,
) => {
  if (getIsOnFootClass(input.vehicleId)) {
    return emitOnFootEffects(spawn, input, latches, random)
  }
  if (input.vehicleId === VEHICLE_IDS.RAGNAROK) {
    emitRagnarokEffects(spawn, input, random)
  }
  return latches
}
