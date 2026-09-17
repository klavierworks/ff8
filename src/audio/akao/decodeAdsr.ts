import { SAMPLE_RATE } from './constants'

// The SPU runs its envelope counter at the sample rate, over a 15-bit level.
const MAX_LEVEL = 0x7fff
const SUSTAIN_LEVEL_STEP = 0x800
const EXPONENTIAL_KNEE = 0x6000
const EXPONENTIAL_KNEE_SLOWDOWN = 4
const EXPONENTIAL_FLOOR = 0x100
const DECREASE_STEP = 8

// A phase with a time constant falls exponentially toward silence rather than along a straight line.
export type AdsrEnvelope = {
  attackSeconds: number
  decaySeconds: number
  decayTimeConstant: number
  releaseSeconds: number
  releaseTimeConstant?: number
  sustainLevel: number
  sustainSeconds: number
  sustainTarget: number
  sustainTimeConstant?: number
}

type Rate = {
  cyclesPerStep: number
  levelsPerStep: number
}

const readRate = (shift: number, step: number): Rate => ({
  cyclesPerStep: 1 << Math.max(0, shift - 11),
  levelsPerStep: step << Math.max(0, 11 - shift),
})

const linearSeconds = (levels: number, rate: Rate) =>
  (Math.max(0, levels) * (rate.cyclesPerStep / rate.levelsPerStep)) / SAMPLE_RATE

// An exponential decrease scales its step by the current level, which integrates to a plain
// exponential decay with this time constant.
const getTimeConstant = (rate: Rate) => ((MAX_LEVEL + 1) * rate.cyclesPerStep) / (rate.levelsPerStep * SAMPLE_RATE)

const exponentialSeconds = (fromLevel: number, toLevel: number, rate: Rate) =>
  getTimeConstant(rate) * Math.log(Math.max(fromLevel, 1) / Math.max(toLevel, EXPONENTIAL_FLOOR))

const attackSeconds = (register: number) => {
  const rate = readRate((register >> 10) & 0x1f, 7 - ((register >> 8) & 0x3))
  const isExponential = (register & 0x8000) !== 0
  if (!isExponential) {
    return linearSeconds(MAX_LEVEL, rate)
  }
  return (
    linearSeconds(EXPONENTIAL_KNEE, rate) +
    linearSeconds(MAX_LEVEL - EXPONENTIAL_KNEE, rate) * EXPONENTIAL_KNEE_SLOWDOWN
  )
}

const sustainPhase = (register: number, sustainLevel: number) => {
  const rate = readRate((register >> 8) & 0x1f, DECREASE_STEP - ((register >> 6) & 0x3))
  const isDecreasing = (register & 0x4000) !== 0
  const isExponential = (register & 0x8000) !== 0
  const target = isDecreasing ? 0 : MAX_LEVEL

  if (isDecreasing && isExponential) {
    return {
      sustainSeconds: exponentialSeconds(sustainLevel, 0, rate),
      sustainTarget: 0,
      sustainTimeConstant: getTimeConstant(rate),
    }
  }
  return { sustainSeconds: linearSeconds(Math.abs(target - sustainLevel), rate), sustainTarget: target / MAX_LEVEL }
}

const releasePhase = (register: number, sustainLevel: number) => {
  const rate = readRate(register & 0x1f, DECREASE_STEP)
  const isExponential = (register & 0x20) !== 0
  if (isExponential) {
    return { releaseSeconds: exponentialSeconds(sustainLevel, 0, rate), releaseTimeConstant: getTimeConstant(rate) }
  }
  return { releaseSeconds: linearSeconds(sustainLevel, rate) }
}

// Turns the two SPU envelope registers each instrument carries into phase times the mixer can
// ramp through. Most music banks ship an instant attack with a short linear release, but a
// handful of instruments rely on the decay and sustain slopes.
export const decodeAdsr = (adsr1: number, adsr2: number): AdsrEnvelope => {
  const sustainLevel = Math.min(MAX_LEVEL, ((adsr1 & 0x0f) + 1) * SUSTAIN_LEVEL_STEP)
  const decayRate = readRate((adsr1 >> 4) & 0x0f, DECREASE_STEP)

  return {
    attackSeconds: attackSeconds(adsr1),
    decaySeconds: exponentialSeconds(MAX_LEVEL, sustainLevel, decayRate),
    decayTimeConstant: getTimeConstant(decayRate),
    sustainLevel: sustainLevel / MAX_LEVEL,
    ...releasePhase(adsr2, sustainLevel),
    ...sustainPhase(adsr2, sustainLevel),
  }
}
