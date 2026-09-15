import {
  ADSR_ATTACK_MODE_MASK,
  ADSR_ATTACK_RATE_MASK,
  ADSR_ATTACK_RATE_SHIFT,
  ADSR_DECAY_RATE_MASK,
  ADSR_DECAY_RATE_SHIFT,
  ADSR_EXPONENTIAL_ATTACK,
  ADSR_EXPONENTIAL_MODE_OPERAND,
  ADSR_EXPONENTIAL_RELEASE,
  ADSR_EXPONENTIAL_RELEASE_OPERAND,
  ADSR_RELEASE_MODE_MASK,
  ADSR_RELEASE_RATE_MASK,
  ADSR_SUSTAIN_LEVEL_MASK,
  ADSR_SUSTAIN_MODE_BITS,
  ADSR_SUSTAIN_MODE_MASK,
  ADSR_SUSTAIN_RATE_MASK,
  ADSR_SUSTAIN_RATE_SHIFT,
} from './constants'

// Instrument maps write the same three fields, so these are tracked to stop a map lookup undoing
// what the sequence asked for.
export type AdsrOverrides = {
  hasAttackRate: boolean
  hasReleaseRate: boolean
  hasSustainRate: boolean
}

export type AdsrRegisters = {
  adsr1: number
  adsr2: number
}

export const NO_ADSR_OVERRIDES: AdsrOverrides = {
  hasAttackRate: false,
  hasReleaseRate: false,
  hasSustainRate: false,
}

const setRegisterField = (register: number, keepMask: number, value: number) =>
  (register & keepMask & 0xffff) | (value & 0xffff)

const setAdsr1Field = (registers: AdsrRegisters, keepMask: number, value: number): AdsrRegisters => ({
  adsr1: setRegisterField(registers.adsr1, keepMask, value),
  adsr2: registers.adsr2,
})

const setAdsr2Field = (registers: AdsrRegisters, keepMask: number, value: number): AdsrRegisters => ({
  adsr1: registers.adsr1,
  adsr2: setRegisterField(registers.adsr2, keepMask, value),
})

export const setAttackRate = (registers: AdsrRegisters, operand: number) =>
  setAdsr1Field(registers, ADSR_ATTACK_RATE_MASK, operand << ADSR_ATTACK_RATE_SHIFT)

export const setDecayRate = (registers: AdsrRegisters, operand: number) =>
  setAdsr1Field(registers, ADSR_DECAY_RATE_MASK, operand << ADSR_DECAY_RATE_SHIFT)

export const setSustainLevel = (registers: AdsrRegisters, operand: number) =>
  setAdsr1Field(registers, ADSR_SUSTAIN_LEVEL_MASK, operand)

export const setAttackMode = (registers: AdsrRegisters, operand: number) =>
  setAdsr1Field(
    registers,
    ADSR_ATTACK_MODE_MASK,
    operand === ADSR_EXPONENTIAL_MODE_OPERAND ? ADSR_EXPONENTIAL_ATTACK : 0,
  )

export const setSustainRate = (registers: AdsrRegisters, operand: number) =>
  setAdsr2Field(registers, ADSR_SUSTAIN_RATE_MASK, operand << ADSR_SUSTAIN_RATE_SHIFT)

export const setSustainMode = (registers: AdsrRegisters, operand: number) =>
  setAdsr2Field(registers, ADSR_SUSTAIN_MODE_MASK, ADSR_SUSTAIN_MODE_BITS[operand] ?? 0)

export const setReleaseRate = (registers: AdsrRegisters, operand: number) =>
  setAdsr2Field(registers, ADSR_RELEASE_RATE_MASK, operand)

export const setReleaseMode = (registers: AdsrRegisters, operand: number) =>
  setAdsr2Field(
    registers,
    ADSR_RELEASE_MODE_MASK,
    operand === ADSR_EXPONENTIAL_RELEASE_OPERAND ? ADSR_EXPONENTIAL_RELEASE : 0,
  )

type AdsrRegionRegisters = {
  attackRate: number
  releaseRate: number
  sustainMode: number
  sustainRate: number
}

// Bits kept from the sounding registers, with both mode fields cleared for the record to refill.
const KEPT_ATTACK_RATE_MASK = 0x7f00
const KEPT_SUSTAIN_RATE_MASK = 0x3fdf
const KEPT_SUSTAIN_MODE_MASK = 0x201f

// Every field the sequence has claimed with an ADSR opcode is held back so the map cannot undo it.
const getAttackBits = ({ current, overrides, region }: RegionRegisterOptions) =>
  overrides.hasAttackRate
    ? current.adsr1 & KEPT_ATTACK_RATE_MASK
    : (region.attackRate << ADSR_ATTACK_RATE_SHIFT) & 0xffff

const getSustainBits = ({ current, overrides, region }: RegionRegisterOptions) => {
  const rate = overrides.hasSustainRate
    ? current.adsr2 & KEPT_SUSTAIN_RATE_MASK
    : (current.adsr2 & KEPT_SUSTAIN_MODE_MASK) | ((region.sustainRate << ADSR_SUSTAIN_RATE_SHIFT) & 0xffff)
  return rate | (ADSR_SUSTAIN_MODE_BITS[region.sustainMode] ?? 0)
}

const getReleaseBits = (options: RegionRegisterOptions) => {
  const { overrides, region } = options
  const sustain = getSustainBits(options)
  return overrides.hasReleaseRate ? sustain : (sustain & ADSR_RELEASE_RATE_MASK) | region.releaseRate
}

type RegionRegisterOptions = {
  current: AdsrRegisters
  instrument: AdsrRegisters
  overrides: AdsrOverrides
  region: AdsrRegionRegisters
}

export const applyRegionRegisters = (options: RegionRegisterOptions): AdsrRegisters => ({
  adsr1: getAttackBits(options) | (options.instrument.adsr1 & ADSR_ATTACK_RATE_MASK),
  adsr2: (getReleaseBits(options) | (options.instrument.adsr2 & ADSR_EXPONENTIAL_RELEASE)) & 0xffff,
})
