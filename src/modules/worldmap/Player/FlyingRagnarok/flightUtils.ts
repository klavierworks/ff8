import { MathUtils } from 'three'

import {
  RAGNAROK_ALTITUDE_GAIN,
  RAGNAROK_ALTITUDE_SHIFT,
  RAGNAROK_BANK_LIMIT,
  RAGNAROK_BANK_RELAX_STEP,
  RAGNAROK_BANK_SHIFT,
  RAGNAROK_CEILING_ALTITUDE,
  RAGNAROK_GROUND_CLEARANCE,
} from '../constants'
import { moveTowardZero } from '../drivingUtils'

export const stepShipBank = (bank: number, turn: number) => {
  if (turn === 0) {
    return moveTowardZero(bank, RAGNAROK_BANK_RELAX_STEP)
  }
  return MathUtils.clamp(bank + (turn >> RAGNAROK_BANK_SHIFT), -RAGNAROK_BANK_LIMIT, RAGNAROK_BANK_LIMIT)
}

export const stepShipAltitude = (altitude: number, altitudeInput: number) =>
  altitude + ((RAGNAROK_ALTITUDE_GAIN * altitudeInput) >> RAGNAROK_ALTITUDE_SHIFT)

export const clampShipAltitude = (altitude: number, groundAltitude: number | undefined) => {
  const belowCeiling = Math.max(altitude, RAGNAROK_CEILING_ALTITUDE)
  if (groundAltitude === undefined) {
    return belowCeiling
  }
  return Math.min(belowCeiling, groundAltitude - RAGNAROK_GROUND_CLEARANCE)
}
