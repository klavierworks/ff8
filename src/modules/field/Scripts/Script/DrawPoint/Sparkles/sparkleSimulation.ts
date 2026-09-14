import { Vector3 } from 'three'

import { SPARKLE_COUNT, SPARKLE_SAMPLE_COUNT } from '../../../../../../constants/drawPoints'
import { vectorToFloatingPoint } from '../../../../../../utils'
import { convert256ToRadians, convertRadiansToAngle256 } from '../../utils'

export type Sparkle = {
  counter: number
  lifetime: number
  midpoint: Vector3
  roll: number
  target: Vector3
}

export type SparkleSample = {
  center: Vector3
  offset: Vector3
}

const FADE_FRAMES = 4
const BURST_SHORTEST_LIFETIME = 24

// Each later slot lives two frames longer than the one before, which is what strings the
// eight ribbons out instead of firing them as a single blob.
const getStaggeredLifetime = (shortestLifetime: number, slot: number) => shortestLifetime + 2 * slot

export const SPARKLE_BURST_FRAMES = getStaggeredLifetime(BURST_SHORTEST_LIFETIME, SPARKLE_COUNT - 1) + FADE_FRAMES + 1

const getRandomAngle = () => Math.floor(Math.random() * 256)

const getRandomJitter = (spread: number) => Math.round(Math.random() * 2 * spread) - spread

const createIdleSparkle = (slot: number): Sparkle => {
  const shortestLifetime = 16
  const riseHeight = 128
  const wander = 128

  return {
    counter: 0,
    lifetime: getStaggeredLifetime(shortestLifetime, slot),
    midpoint: new Vector3(getRandomJitter(wander), getRandomJitter(wander), riseHeight / 2),
    roll: getRandomAngle(),
    target: new Vector3(0, 0, riseHeight),
  }
}

const createBurstSparkle = (slot: number, target: Vector3, roll: number): Sparkle => {
  const scatter = 512
  const arcHeight = 1000 + 128 * slot

  return {
    counter: 0,
    lifetime: getStaggeredLifetime(BURST_SHORTEST_LIFETIME, slot),
    midpoint: new Vector3(getRandomJitter(scatter), getRandomJitter(scatter), arcHeight),
    roll,
    target,
  }
}

// Each rib spreads on the perpendicular of the roll, so rolling a quarter turn off the
// heading to the drawer is what lays the ribbon out along the path it is about to fly.
const calculateBurstRoll = (target: Vector3) => {
  const quarterTurn = 64

  return convertRadiansToAngle256(Math.atan2(target.y, target.x)) + quarterTurn
}

export const createSparkles = () => Array.from({ length: SPARKLE_COUNT }, (_, slot) => createIdleSparkle(slot))

export const createBurstSparkles = (target: Vector3) => {
  const roll = calculateBurstRoll(target)

  return Array.from({ length: SPARKLE_COUNT }, (_, slot) => createBurstSparkle(slot, target, roll))
}

// The pool never empties: an expired slot re-seeds as an idle wisp, so a burst decays
// straight back into the ambient sparkle.
export const advanceSparkles = (sparkles: readonly Sparkle[]) =>
  sparkles.map((sparkle, slot) => {
    const counter = sparkle.counter + 1
    if (counter > sparkle.lifetime + FADE_FRAMES) {
      return createIdleSparkle(slot)
    }

    return { ...sparkle, counter }
  })

const calculateSampleCenter = (sparkle: Sparkle, counter: number) => {
  if (counter > sparkle.lifetime) {
    return sparkle.target.clone()
  }

  const progress = counter / sparkle.lifetime
  const rising = new Vector3().lerp(sparkle.midpoint, progress)
  const falling = sparkle.midpoint.clone().lerp(sparkle.target, progress)

  return rising.lerp(falling, progress)
}

// The width sweeps a whole turn every 32 frames, so the ribbon swells to its widest at
// the midpoint, pinches to nothing, then flips and opens out again as it fades.
const calculateSampleOffset = (sparkle: Sparkle, counter: number) => {
  const taperAnglePerFrame = 8
  const widestHalfWidth = 16
  const halfWidth = widestHalfWidth * Math.sin(convert256ToRadians(counter * taperAnglePerFrame))
  const roll = convert256ToRadians(sparkle.roll)

  return new Vector3(halfWidth * Math.sin(roll), -halfWidth * Math.cos(roll), 0)
}

// A rib is a pure function of the frame it was laid down on, so the trail rebuilds from
// the current counter instead of being carried in the engine's ring buffer.
export const getSparkleTrail = (sparkle: Sparkle): SparkleSample[] =>
  Array.from({ length: SPARKLE_SAMPLE_COUNT }, (_, age) => {
    const counter = Math.max(sparkle.counter - age, 0)

    return {
      center: vectorToFloatingPoint(calculateSampleCenter(sparkle, counter)),
      offset: vectorToFloatingPoint(calculateSampleOffset(sparkle, counter)),
    }
  })
