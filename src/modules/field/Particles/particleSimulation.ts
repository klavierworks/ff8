import type { FieldParticles } from '@data/types/field/FieldParticles'

import { Vector3 } from 'three'

import { VIEW_UNITS_PER_DEPTH_SLOT } from '../../../constants/depth'
import { numberToFloatingPoint } from '../../../utils'
import { getNextRandomByte, getRandomSpread } from './particleRandom'

export type ParticleData = FieldParticles
export type ParticleEmitter = FieldParticles['emitters'][number]
export type ParticleKeyframe = ParticleType['keyframes'][number]
export type ParticleType = FieldParticles['types'][number]

export const EMITTER_SLOT_COUNT = 16
export const EMITTER_MODE_OFF = 0
export const EMITTER_MODE_PATH = 1
export const EMITTER_MODE_ENTITY_FLAG = 0x80
const EMITTER_ENTITY_MASK = 0x7f

export const PARTICLE_POOL_SIZE = 128

const POSITION_SCALE = 16
const SPAWN_JITTER_SCALE = 8
const SPRITE_UNITS_PER_SIZE = 4
const DOUBLE_SPRITE_UNITS_PER_SIZE = 8
const COLOR_NEUTRAL = 128
const ANGLE_UNITS_PER_TURN = 4096
const PATH_MODE_POINT = 1
const PATH_MODE_LINE = 2
const PATH_MODE_CURVE = 3
const RATE_INTERVAL_SHIFT = 3

export type EntityPositionLookup = (entityId: number, target: Vector3) => boolean

export type ParticleSimulation = {
  emittersBySlot: (ParticleEmitter | undefined)[]
  emitterStates: EmitterState[]
  hasPrewarmed: boolean
  liveCountByType: number[]
  particles: LiveParticle[]
  spriteCount: number
  sprites: ParticleSprite[]
  textureTop: number
  typesById: (ParticleType | undefined)[]
}

export type ParticleSprite = {
  blendMode: number
  blue: number
  depthOffset: number
  green: number
  halfHeight: number
  halfWidth: number
  position: Vector3
  red: number
  rotation: number
  textureHeight: number
  textureLeft: number
  textureTop: number
  textureWidth: number
}

type EmitterState = {
  pathPosition: number
  sourceCounters: number[]
  stepFrameCounter: number
  stepIndex: number
}

type LiveParticle = {
  animationFrame: number
  isAlive: boolean
  keyframeIndex: number
  rotation: number
  rotationSpeed: number
  typeId: number
  velocityX: number
  velocityY: number
  velocityZ: number
  x: number
  y: number
  z: number
}

const _origin = new Vector3()

const createSprite = (): ParticleSprite => ({
  blendMode: 0,
  blue: 1,
  depthOffset: 0,
  green: 1,
  halfHeight: 0,
  halfWidth: 0,
  position: new Vector3(),
  red: 1,
  rotation: 0,
  textureHeight: 0,
  textureLeft: 0,
  textureTop: 0,
  textureWidth: 0,
})

const createParticle = (): LiveParticle => ({
  animationFrame: 0,
  isAlive: false,
  keyframeIndex: 0,
  rotation: 0,
  rotationSpeed: 0,
  typeId: 0,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
  x: 0,
  y: 0,
  z: 0,
})

const createEmitterState = (sourceCount: number): EmitterState => ({
  pathPosition: 0,
  sourceCounters: new Array<number>(sourceCount).fill(0),
  stepFrameCounter: 0,
  stepIndex: 0,
})

const indexBySlot = <T extends { id: number }>(entries: readonly T[], slots: number) => {
  const bySlot = new Array<T | undefined>(slots).fill(undefined)
  entries.forEach((entry) => {
    bySlot[entry.id] = entry
  })
  return bySlot
}

export const createParticleSimulation = (data: ParticleData): ParticleSimulation => {
  const emittersBySlot = indexBySlot(data.emitters, EMITTER_SLOT_COUNT)

  return {
    emittersBySlot,
    emitterStates: emittersBySlot.map((emitter) => createEmitterState(emitter?.sources.length ?? 0)),
    hasPrewarmed: false,
    liveCountByType: new Array<number>(EMITTER_SLOT_COUNT).fill(0),
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, createParticle),
    spriteCount: 0,
    sprites: Array.from({ length: PARTICLE_POOL_SIZE }, createSprite),
    textureTop: data.textureTop,
    typesById: indexBySlot(data.types, EMITTER_SLOT_COUNT),
  }
}

// Integer interpolation with the original's truncation: a keyframe's value is only ever
// nudged toward the next one by whole units, so short keyframes hold their value longer.
const interpolate = (from: number, to: number, elapsed: number, duration: number) =>
  Math.trunc((elapsed * (to - from)) / duration)

const blendValue = (from: number, to: number, elapsed: number, duration: number) =>
  duration === 0 ? from : from + interpolate(from, to, elapsed, duration)

const toSignedWord = (value: number) => (value << 16) >> 16

// Spawn jitter doubles the random byte after the shift rather than before it, so it lands on
// even offsets only. The velocity and rotation jitters shift after scaling and do not.
const getSteppedRandomSpread = (spread: number) => 2 * ((spread * getNextRandomByte()) >> 8) - spread

const getScaledRandomSpread = (spread: number) =>
  ((2 * POSITION_SCALE * spread * getNextRandomByte()) >> 8) - POSITION_SCALE * spread

const findFreeParticle = (simulation: ParticleSimulation) => simulation.particles.find((particle) => !particle.isAlive)

const killParticle = (simulation: ParticleSimulation, particle: LiveParticle) => {
  particle.isAlive = false
  simulation.liveCountByType[particle.typeId] -= 1
}

const placeParticle = (particle: LiveParticle, type: ParticleType, origin: Vector3) => {
  particle.animationFrame = 0
  particle.isAlive = true
  particle.keyframeIndex = 0
  particle.typeId = type.id

  particle.rotation = toSignedWord(
    POSITION_SCALE * (2 * type.rotationBase - type.rotationSpread) +
      ((2 * POSITION_SCALE * type.rotationSpread * getNextRandomByte()) >> 8),
  )
  particle.rotationSpeed = getRandomSpread(type.rotationSpeedSpread)

  particle.x = POSITION_SCALE * (origin.x + SPAWN_JITTER_SCALE * getSteppedRandomSpread(type.spawnSpread[0]))
  particle.y = POSITION_SCALE * (origin.y + SPAWN_JITTER_SCALE * getSteppedRandomSpread(type.spawnSpread[1]))
  particle.z = POSITION_SCALE * (origin.z + SPAWN_JITTER_SCALE * getSteppedRandomSpread(type.spawnSpread[2]))

  particle.velocityX = getScaledRandomSpread(type.velocitySpread[0])
  particle.velocityY = getScaledRandomSpread(type.velocitySpread[1])
  particle.velocityZ = getScaledRandomSpread(type.velocitySpread[2])
}

const spawnParticles = (simulation: ParticleSimulation, typeId: number, origin: Vector3, count: number) => {
  const type = simulation.typesById[typeId]
  if (!type) {
    return
  }

  for (let spawned = 0; spawned < count; spawned += 1) {
    if (simulation.liveCountByType[typeId] >= type.maxLive) {
      return
    }
    const particle = findFreeParticle(simulation)
    if (!particle) {
      return
    }
    simulation.liveCountByType[typeId] += 1
    placeParticle(particle, type, origin)
  }
}

const readPathPoint = (emitter: ParticleEmitter, point: number, axis: number) => emitter.path[point][axis]

const getCurvePosition = (emitter: ParticleEmitter, position: number, axis: number) => {
  const length = emitter.pathLength
  const start = readPathPoint(emitter, 0, axis)
  const middle = readPathPoint(emitter, 1, axis)
  const end = readPathPoint(emitter, 2, axis)
  const first = start + interpolate(start, middle, position, length)
  const second = middle + interpolate(middle, end, position, length)
  return first + interpolate(first, second, position, length)
}

const getLinePosition = (emitter: ParticleEmitter, position: number, axis: number) => {
  const start = readPathPoint(emitter, 0, axis)
  return start + interpolate(start, readPathPoint(emitter, 1, axis), position, emitter.pathLength)
}

const readEmitterOrigin = (emitter: ParticleEmitter, position: number, target: Vector3) => {
  if (emitter.pathMode === PATH_MODE_POINT) {
    target.set(readPathPoint(emitter, 0, 0), readPathPoint(emitter, 0, 1), readPathPoint(emitter, 0, 2))
    return true
  }
  if (emitter.pathLength <= 0) {
    return false
  }
  if (emitter.pathMode === PATH_MODE_LINE) {
    target.set(
      getLinePosition(emitter, position, 0),
      getLinePosition(emitter, position, 1),
      getLinePosition(emitter, position, 2),
    )
    return true
  }
  if (emitter.pathMode === PATH_MODE_CURVE) {
    target.set(
      getCurvePosition(emitter, position, 0),
      getCurvePosition(emitter, position, 1),
      getCurvePosition(emitter, position, 2),
    )
    return true
  }
  return false
}

const resolveEmitterOrigin = (
  emitter: ParticleEmitter,
  state: EmitterState,
  mode: number,
  getEntityPosition: EntityPositionLookup,
  target: Vector3,
) => {
  if (mode !== EMITTER_MODE_PATH) {
    return getEntityPosition(mode & EMITTER_ENTITY_MASK, target)
  }
  return readEmitterOrigin(emitter, state.pathPosition, target)
}

// A rate byte below 8 is a per-frame particle count; from 8 up it is a frame interval firing
// one particle each time. A rate of zero fires every frame for no particles.
const isSpawnDue = (rate: number, counter: number) => counter >= rate >> RATE_INTERVAL_SHIFT

const readSpawnCount = (rate: number) => (rate >= 1 << RATE_INTERVAL_SHIFT ? 1 : rate)

const spawnFromEmitter = (
  simulation: ParticleSimulation,
  emitter: ParticleEmitter,
  state: EmitterState,
  mode: number,
  getEntityPosition: EntityPositionLookup,
) => {
  const hasOrigin = resolveEmitterOrigin(emitter, state, mode, getEntityPosition, _origin)

  emitter.sources.forEach((source, index) => {
    const rate = source.rates[state.stepIndex] ?? 0
    const isDue = isSpawnDue(rate, state.sourceCounters[index])
    state.sourceCounters[index] = isDue ? 1 : state.sourceCounters[index] + 1

    if (isDue && hasOrigin) {
      spawnParticles(simulation, source.typeId, _origin, readSpawnCount(rate))
    }
  })
}

const advanceEmitterStep = (emitter: ParticleEmitter, state: EmitterState) => {
  if (state.stepFrameCounter < (emitter.stepDurations[state.stepIndex] ?? 0)) {
    return
  }
  state.stepFrameCounter = 0
  state.stepIndex += 1
  if (!emitter.stepDurations[state.stepIndex]) {
    state.stepIndex = 0
    state.pathPosition = 0
  }
}

const resetEmitterState = (state: EmitterState) => {
  state.pathPosition = 0
  state.stepFrameCounter = 0
  state.stepIndex = 0
}

const advanceEmitters = (
  simulation: ParticleSimulation,
  emitterModes: readonly number[],
  getEntityPosition: EntityPositionLookup,
  prewarmFrame?: number,
) => {
  simulation.emittersBySlot.forEach((emitter, slot) => {
    const state = simulation.emitterStates[slot]
    const mode = emitterModes[slot] ?? EMITTER_MODE_OFF
    if (mode === EMITTER_MODE_OFF) {
      resetEmitterState(state)
      return
    }
    if (!emitter || (prewarmFrame !== undefined && prewarmFrame > emitter.prewarmFrames)) {
      return
    }

    advanceEmitterStep(emitter, state)
    spawnFromEmitter(simulation, emitter, state, mode, getEntityPosition)
    state.pathPosition += 1
    state.stepFrameCounter += 1
  })
}

const recordSprite = (
  simulation: ParticleSimulation,
  particle: LiveParticle,
  type: ParticleType,
  current: ParticleKeyframe,
  next: ParticleKeyframe,
) => {
  const sprite = simulation.sprites[simulation.spriteCount]
  simulation.spriteCount += 1

  const elapsed = particle.animationFrame
  const duration = current.duration

  const unitsPerSize = type.isDoubleSized ? DOUBLE_SPRITE_UNITS_PER_SIZE : SPRITE_UNITS_PER_SIZE
  sprite.halfWidth = numberToFloatingPoint(blendValue(current.width, next.width, elapsed, duration) * unitsPerSize)
  sprite.halfHeight = numberToFloatingPoint(blendValue(current.height, next.height, elapsed, duration) * unitsPerSize)

  sprite.red = blendValue(current.color[0], next.color[0], elapsed, duration) / COLOR_NEUTRAL
  sprite.green = blendValue(current.color[1], next.color[1], elapsed, duration) / COLOR_NEUTRAL
  sprite.blue = blendValue(current.color[2], next.color[2], elapsed, duration) / COLOR_NEUTRAL

  sprite.blendMode = current.blendMode
  sprite.depthOffset = numberToFloatingPoint(type.depthBias * VIEW_UNITS_PER_DEPTH_SLOT)
  sprite.textureLeft = current.texture[0]
  sprite.textureTop = current.texture[1] - simulation.textureTop
  sprite.textureWidth = current.texture[2]
  sprite.textureHeight = current.texture[3]

  sprite.rotation = (particle.rotation / ANGLE_UNITS_PER_TURN) * Math.PI * 2
  sprite.position.set(
    numberToFloatingPoint(Math.trunc(particle.x / POSITION_SCALE)),
    numberToFloatingPoint(Math.trunc(particle.y / POSITION_SCALE)),
    numberToFloatingPoint(Math.trunc(particle.z / POSITION_SCALE)),
  )
}

const moveParticle = (particle: LiveParticle, current: ParticleKeyframe, next: ParticleKeyframe) => {
  const elapsed = particle.animationFrame
  const duration = current.duration

  particle.rotation = toSignedWord(
    particle.rotation +
      POSITION_SCALE *
        (current.rotationSpeed +
          particle.rotationSpeed +
          interpolate(current.rotationSpeed, next.rotationSpeed, elapsed, duration)),
  )
  particle.x += blendValue(current.velocity[0], next.velocity[0], elapsed, duration) + particle.velocityX
  particle.y += blendValue(current.velocity[1], next.velocity[1], elapsed, duration) + particle.velocityY
  particle.z += blendValue(current.velocity[2], next.velocity[2], elapsed, duration) + particle.velocityZ
}

const advanceParticle = (simulation: ParticleSimulation, particle: LiveParticle) => {
  const type = simulation.typesById[particle.typeId]
  const current = type?.keyframes[particle.keyframeIndex]
  if (!type || !current) {
    killParticle(simulation, particle)
    return
  }

  const next = type.keyframes[particle.keyframeIndex + 1] ?? current
  if (current.duration !== 0) {
    moveParticle(particle, current, next)
  }
  recordSprite(simulation, particle, type, current, next)

  particle.animationFrame += 1
  if (particle.animationFrame >= current.duration) {
    particle.animationFrame = 0
    particle.keyframeIndex += 1
  }
  if (!type.keyframes[particle.keyframeIndex]?.duration) {
    killParticle(simulation, particle)
  }
}

const advanceParticles = (simulation: ParticleSimulation) => {
  simulation.spriteCount = 0
  simulation.particles.forEach((particle) => {
    if (particle.isAlive) {
      advanceParticle(simulation, particle)
    }
  })
}

// Emitters are run forward on field entry so a map opens with its particles already settled
// rather than filling in from empty. Each emitter stops contributing once its own prewarm
// count is passed, but every particle keeps ageing for the longest count on the map.
const runPrewarm = (
  simulation: ParticleSimulation,
  emitterModes: readonly number[],
  getEntityPosition: EntityPositionLookup,
) => {
  const activeFrames = simulation.emittersBySlot.map((emitter, slot) =>
    emitter && emitterModes[slot] !== EMITTER_MODE_OFF ? emitter.prewarmFrames : 0,
  )
  const totalFrames = Math.max(0, ...activeFrames)

  for (let frame = 0; frame < totalFrames; frame += 1) {
    advanceEmitters(simulation, emitterModes, getEntityPosition, frame)
    advanceParticles(simulation)
  }
}

// Only emitters the field's own setup scripts switch on are pre-run; anything a script
// starts later builds up from nothing, the way it does in the original.
const takePrewarm = (
  simulation: ParticleSimulation,
  emitterModes: readonly number[],
  getEntityPosition: EntityPositionLookup,
  isEnteringField: boolean,
) => {
  if (simulation.hasPrewarmed) {
    return
  }
  if (!isEnteringField) {
    simulation.hasPrewarmed = true
    return
  }
  if (emitterModes.some((mode) => mode !== EMITTER_MODE_OFF)) {
    simulation.hasPrewarmed = true
    runPrewarm(simulation, emitterModes, getEntityPosition)
  }
}

export const stepParticleSimulation = (
  simulation: ParticleSimulation,
  emitterModes: readonly number[],
  getEntityPosition: EntityPositionLookup,
  isEnteringField: boolean,
) => {
  takePrewarm(simulation, emitterModes, getEntityPosition, isEnteringField)
  advanceEmitters(simulation, emitterModes, getEntityPosition)
  advanceParticles(simulation)
}
