import type { WorldmapEffects } from '@data/types/worldmap/WorldmapEffects'

import { Matrix3, Vector3 } from 'three'

import { PSX_ANGLE_TO_RAD } from '../constants'

export type EffectDefinition = WorldmapEffects[number]

export type LiveEffect = {
  age: number
  effectId: number
  lifetime: number
  position: PsxVector
  rotation: PsxVector
  scale: number
  velocity: PsxVector
}

export type PsxVector = {
  x: number
  y: number
  z: number
}

export type RandomByte = () => number

export const EFFECT_POOL_SIZE = 64
export const SPAWN_JITTER_LIFETIME = 1
export const SPAWN_JITTER_SCALE = 2

const FIXED_POINT_ONE = 4096
const HALF_SIZE_DIVISOR = 8192
const BYTE_MASK = 0xff
const WORD_MASK = 0xffff
const SCALE_JITTER_CENTER = 128
const LIFETIME_JITTER_MASK = 7
const LIFETIME_JITTER_CENTER = 4
const PLAYER_FOLLOW_EFFECT_IDS: ReadonlySet<number> = new Set([12, 13])
const PLAYER_FOLLOW_NUMERATOR = 5
const PLAYER_FOLLOW_DENOMINATOR = 6

const _rotationX = new Matrix3()
const _rotationY = new Matrix3()
const _rotationZ = new Matrix3()
const _rotation = new Matrix3()
const _vector = new Vector3()

const createFreeSlot = (): LiveEffect => ({
  age: 0,
  effectId: 0,
  lifetime: 0,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: FIXED_POINT_ONE,
  velocity: { x: 0, y: 0, z: 0 },
})

export const createEffectPool = () => Array.from({ length: EFFECT_POOL_SIZE }, createFreeSlot)

export const getIsEffectLive = (effect: LiveEffect) => effect.age < effect.lifetime

// The engine builds Rz first, then multiplies Ry and Rx onto the left, so vectors turn about Z,
// then Y, then X.
export const buildPsxRotation = (rotation: PsxVector, target: Matrix3) => {
  const cosineX = Math.cos(rotation.x * PSX_ANGLE_TO_RAD)
  const sineX = Math.sin(rotation.x * PSX_ANGLE_TO_RAD)
  const cosineY = Math.cos(rotation.y * PSX_ANGLE_TO_RAD)
  const sineY = Math.sin(rotation.y * PSX_ANGLE_TO_RAD)
  const cosineZ = Math.cos(rotation.z * PSX_ANGLE_TO_RAD)
  const sineZ = Math.sin(rotation.z * PSX_ANGLE_TO_RAD)
  _rotationX.set(1, 0, 0, 0, cosineX, sineX, 0, -sineX, cosineX)
  _rotationY.set(cosineY, 0, -sineY, 0, 1, 0, sineY, 0, cosineY)
  _rotationZ.set(cosineZ, sineZ, 0, -sineZ, cosineZ, 0, 0, 0, 1)
  return target.multiplyMatrices(_rotationX, _rotationY).multiply(_rotationZ)
}

export const rotatePsxVector = (vector: PsxVector, rotation: PsxVector): PsxVector => {
  _vector.set(vector.x, vector.y, vector.z).applyMatrix3(buildPsxRotation(rotation, _rotation))
  return { x: Math.trunc(_vector.x), y: Math.trunc(_vector.y), z: Math.trunc(_vector.z) }
}

const getSpawnScale = (flags: number, random: RandomByte) =>
  (flags & SPAWN_JITTER_SCALE) !== 0 ? FIXED_POINT_ONE + random() - SCALE_JITTER_CENTER : FIXED_POINT_ONE

const getSpawnLifetime = (definition: EffectDefinition, flags: number, random: RandomByte) =>
  (flags & SPAWN_JITTER_LIFETIME) !== 0
    ? (definition.lifetime + (random() & LIFETIME_JITTER_MASK) - LIFETIME_JITTER_CENTER) & BYTE_MASK
    : definition.lifetime

const toPsxVector = ([x, y, z]: number[]): PsxVector => ({ x, y, z })

export const spawnEffect = (
  pool: LiveEffect[],
  definition: EffectDefinition,
  position: PsxVector,
  rotation: PsxVector,
  flags: number,
  random: RandomByte,
) => {
  const slotIndex = pool.findIndex((effect) => !getIsEffectLive(effect))
  if (slotIndex < 0) {
    return
  }
  const scale = getSpawnScale(flags, random)
  pool[slotIndex] = {
    age: 0,
    effectId: definition.id,
    lifetime: getSpawnLifetime(definition, flags, random),
    position: { ...position },
    rotation: { ...rotation },
    scale,
    velocity: rotatePsxVector(toPsxVector(definition.velocity), rotation),
  }
}

const addFollowMotion = (effect: LiveEffect, playerDelta: PsxVector) => {
  effect.position.x += Math.trunc((PLAYER_FOLLOW_NUMERATOR * playerDelta.x) / PLAYER_FOLLOW_DENOMINATOR)
  effect.position.y += Math.trunc((PLAYER_FOLLOW_NUMERATOR * playerDelta.y) / PLAYER_FOLLOW_DENOMINATOR)
  effect.position.z += Math.trunc((PLAYER_FOLLOW_NUMERATOR * playerDelta.z) / PLAYER_FOLLOW_DENOMINATOR)
}

const stepEffect = (effect: LiveEffect, definition: EffectDefinition, playerDelta: PsxVector) => {
  effect.scale = Math.trunc((effect.scale * definition.scaleRate) / FIXED_POINT_ONE) & WORD_MASK
  effect.position.x += effect.velocity.x
  effect.position.y += effect.velocity.y
  effect.position.z += effect.velocity.z
  if (effect.age > 0 && PLAYER_FOLLOW_EFFECT_IDS.has(effect.effectId)) {
    addFollowMotion(effect, playerDelta)
  }
  effect.velocity.x += definition.acceleration[0]
  effect.velocity.y += definition.acceleration[1]
  effect.velocity.z += definition.acceleration[2]
  effect.age += 1
}

export const stepEffectPool = (
  pool: LiveEffect[],
  definitions: readonly EffectDefinition[],
  playerDelta: PsxVector,
) => {
  pool.forEach((effect) => {
    if (getIsEffectLive(effect)) {
      stepEffect(effect, definitions[effect.effectId], playerDelta)
    }
  })
}

export const getEffectHalfSize = (effect: LiveEffect, definition: EffectDefinition) =>
  Math.trunc((effect.scale * definition.size) / HALF_SIZE_DIVISOR)

export const getEffectAnimationFrame = (effect: LiveEffect, sprite: NonNullable<EffectDefinition['sprite']>) =>
  Math.min(Math.max(Math.trunc(effect.age / sprite.framesPerAnimationFrame), 0), sprite.frameCount - 1)
