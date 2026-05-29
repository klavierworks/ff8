import { VEHICLE_IDS } from '../../../../constants/vehicles'

// Aliases of `VEHICLE_IDS.ON_FOOT` / `VEHICLE_IDS.RAGNAROK` for downstream
// imports that already reference these symbols. New code should import from
// `src/constants/vehicles.ts` directly.
export const VEHICLE_ON_FOOT = VEHICLE_IDS.ON_FOOT
export const VEHICLE_RAGNAROK = VEHICLE_IDS.RAGNAROK
