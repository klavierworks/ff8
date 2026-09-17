import { VEHICLE_IDS } from '../../../constants/vehicles'
import { WORLD_MAP_STATE_RAGNAROK_LANDING, WORLD_MAP_STATE_RAGNAROK_TAKEOFF } from '../worldmapStore'
import { PsxVector, RandomByte, rotatePsxVector, SPAWN_JITTER_SCALE } from './effectPool'
import {
  emitSplashBurst,
  emitSprayPair,
  EmitterInput,
  emitWaterSpray,
  FULL_JITTER,
  getIsCanopyOrShallowWater,
  getWideJitteredRotation,
  getWideJitteredYaw,
  SpawnEffect,
  toSignedWord,
  WATER_GROUND_TYPE,
} from './emitterUtils'
import { emitVehicleEffects } from './vehicleEmitters'

export type FootLatches = [boolean, boolean]

const ON_FOOT_CLASS_LIMIT = 10

const EFFECT_FOREST_LEAVES_FIRST = 4
const EFFECT_RAGNAROK_EXHAUST_SPARK = 12
const EFFECT_RAGNAROK_EXHAUST_GLOW = 13
const EFFECT_RAGNAROK_CANOPY_SPRAY = 15
const EFFECT_FOOTPRINT = 16
const EFFECT_RAGNAROK_GROUND_DUST = 20
const EFFECT_FORCE_FIELD_FLASH = 21

const FOREST_GROUND_TYPE_MAX = 5
const FOOTPRINT_GROUND_TYPES: ReadonlySet<number> = new Set([9, 11, 17])
const RAGNAROK_DUST_GROUND_TYPES: ReadonlySet<number> = new Set([9, 17])

const FOOT_STRIKE_FRAME_UNITS = [272, 112]
const SPLASH_FRAME_UNITS = [304, 144]
const SPLASH_FRAME_TOLERANCE = 4
const FOOTPRINT_YAW_OFFSET = 128

const FOREST_LEAVES_HEIGHT = 320
const FORCE_FIELD_FLASH_HEIGHT = 200
const LEAVES_SPEED_FACTOR = 8
const NARROW_ROLL_JITTER_CENTER = 128

const RAGNAROK_CANOPY_SPRAY_MAX_HEIGHT = 420
const RAGNAROK_EXHAUST_DROP = 146
const RAGNAROK_EXHAUST_OFFSETS: readonly PsxVector[] = [
  { x: 188, y: 108, z: -386 },
  { x: -188, y: 108, z: -386 },
]

const getIsOnFootClass = (vehicleId: number) => vehicleId < ON_FOOT_CLASS_LIMIT || vehicleId === VEHICLE_IDS.ON_FOOT

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

const emitForceFieldFlash = (spawn: SpawnEffect, input: EmitterInput) => {
  if (input.forceFieldFlashYaw === undefined) {
    return
  }
  const flashPosition = { ...input.position, y: input.position.y - FORCE_FIELD_FLASH_HEIGHT }
  spawn(EFFECT_FORCE_FIELD_FLASH, flashPosition, { x: 0, y: input.forceFieldFlashYaw, z: 0 }, 0)
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

const emitRagnarokGroundEffects = (spawn: SpawnEffect, input: EmitterInput, random: RandomByte) => {
  const { groundType, groundY, position, speed, yaw } = input
  if (groundType === undefined || groundY === undefined) {
    return
  }
  const baseRotation = { x: 0, y: yaw, z: 0 }
  const groundPosition = { ...position, y: groundY }
  const height = toSignedWord(groundY - position.y)

  if (groundType === WATER_GROUND_TYPE) {
    emitWaterSpray(spawn, input, groundY, random)
    return
  }

  if (getIsCanopyOrShallowWater(groundType)) {
    const isSprayRolled = speed > (height >> 2) + random() && Math.abs(height) < RAGNAROK_CANOPY_SPRAY_MAX_HEIGHT
    if (isSprayRolled) {
      emitSprayPair(spawn, EFFECT_RAGNAROK_CANOPY_SPRAY, groundPosition, (yawOffset) => ({
        x: baseRotation.x,
        y: getWideJitteredYaw(baseRotation.y, yawOffset, random),
        z: baseRotation.z + random() - NARROW_ROLL_JITTER_CENTER,
      }))
    }
    return
  }

  const isDustRolled = speed >> 1 > ((groundY - position.y) >> 4) + random()
  if (RAGNAROK_DUST_GROUND_TYPES.has(groundType) && isDustRolled) {
    emitSprayPair(spawn, EFFECT_RAGNAROK_GROUND_DUST, groundPosition, (yawOffset) =>
      getWideJitteredRotation(baseRotation, yawOffset, random),
    )
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
    const nextLatches = emitOnFootEffects(spawn, input, latches, random)
    emitForceFieldFlash(spawn, input)
    return nextLatches
  }
  if (input.vehicleId === VEHICLE_IDS.RAGNAROK) {
    emitRagnarokEffects(spawn, input, random)
  }
  emitVehicleEffects(spawn, input, random)
  return latches
}
