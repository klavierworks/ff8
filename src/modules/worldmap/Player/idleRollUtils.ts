import { RANDOM_BYTE_TABLE } from '../../../constants/random'
import { ROLL_THRESHOLD_STEP } from './constants'

export type RollState = {
  counter: number
  threshold: number
}

export const INITIAL_ROLL_STATE: RollState = { counter: 0, threshold: 0 }

export const rollRandom = ({ counter, threshold }: RollState) => {
  const nextCounter = (counter + 1) & 0xff
  const nextThreshold = nextCounter === 0 ? (threshold + ROLL_THRESHOLD_STEP) & 0xff : threshold
  return {
    state: { counter: nextCounter, threshold: nextThreshold },
    value: (RANDOM_BYTE_TABLE[nextCounter] - nextThreshold) & 0xff,
  }
}
