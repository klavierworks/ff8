import { WORLDMAP_SCALE } from '../../constants'
import { SpecialLocation } from '../../useSections'
import { RagnarokLandingSpot } from '../../worldmapStore'
import { psxXToWorld, psxZToWorld } from '../playerUtils'

// `section_35_special_locations` entries that mark Ragnarok parking spots in
// the shipped data. Per ida.md ("Ragnarok parking entities"), these are entries
// with `type_code == 50` — the same vehicle tag the Ragnarok itself carries,
// used by the original's proximity scan as the dismount target.
const RAGNAROK_SPECIAL_LOCATION_TYPE_CODE = 50

// Sub-section 35 stores Y as the in-engine "altitude" PSX value (negative =
// up). Convert to world-space by sign-flipping and scaling, the same way the
// existing entity / player pipelines do (`Entity.tsx` uses
// `-entity.positionVerticalY * WORLDMAP_SCALE` as the fallback Y).
const psxAltitudeToWorld = (psxY: number): number => -psxY * WORLDMAP_SCALE

export const buildLandingSpotsFromSection35 = (locations: readonly SpecialLocation[]): RagnarokLandingSpot[] =>
  locations
    .filter((location) => location.type_code === RAGNAROK_SPECIAL_LOCATION_TYPE_CODE)
    .map((location) => ({
      worldX: psxXToWorld(location.x),
      worldY: psxAltitudeToWorld(location.y),
      worldZ: psxZToWorld(location.z),
    }))

// Search radius for "am I over a landing zone?" — mirrors the original's
// proximity scan that gates the dismount prompt. Measured on the X/Z plane
// only; vertical distance is irrelevant since the ship may be cruising far
// above the spot when the action button is pressed.
const RAGNAROK_LANDING_RADIUS_PSX = 4096
const RAGNAROK_LANDING_RADIUS_SQUARED = (RAGNAROK_LANDING_RADIUS_PSX * WORLDMAP_SCALE) ** 2

type NearestLandingSpot = {
  distanceSquared: number
  spot: null | RagnarokLandingSpot
}

export const findNearestLandingSpot = (
  spots: readonly RagnarokLandingSpot[],
  worldX: number,
  worldZ: number,
): null | RagnarokLandingSpot => {
  const nearest = spots.reduce<NearestLandingSpot>(
    (best, spot) => {
      const dx = spot.worldX - worldX
      const dz = spot.worldZ - worldZ
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared < best.distanceSquared) {
        return { distanceSquared, spot }
      }
      return best
    },
    { distanceSquared: RAGNAROK_LANDING_RADIUS_SQUARED, spot: null },
  )
  return nearest.spot
}
