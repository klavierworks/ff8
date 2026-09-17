import {
  CHICOBO_ALTITUDE_LIMIT,
  COMPANION_TRAIL_FIRST_WRITE_INDEX,
  COMPANION_TRAIL_LAG,
  COMPANION_TRAIL_LENGTH,
} from '../../../../constants/worldmapVehicles'

export type CompanionTrail = {
  entries: readonly TrailEntry[]
  isAdvancing: boolean
  lastSource: TrailEntry
  readIndex: number
  writeIndex: number
}

export type TrailEntry = {
  altitude: number
  heading: number
  isOnCanopy: boolean
  x: number
  z: number
}

type TrailAdvanceRequest = {
  hasPlayerMoved: boolean
  isFollowing: boolean
  isRunningOff: boolean
}

const wrapTrailIndex = (index: number) => (index + COMPANION_TRAIL_LENGTH) % COMPANION_TRAIL_LENGTH

export const createCompanionTrail = (source: TrailEntry): CompanionTrail => ({
  entries: Array.from({ length: COMPANION_TRAIL_LENGTH }, () => source),
  isAdvancing: false,
  lastSource: source,
  readIndex: 0,
  writeIndex: COMPANION_TRAIL_FIRST_WRITE_INDEX,
})

const recordTrailSource = (trail: CompanionTrail, source: TrailEntry): CompanionTrail => {
  if (source.x === trail.lastSource.x && source.z === trail.lastSource.z) {
    return { ...trail, lastSource: source }
  }
  return {
    ...trail,
    entries: trail.entries.map((entry, index) => (index === trail.writeIndex ? source : entry)),
    lastSource: source,
    writeIndex: wrapTrailIndex(trail.writeIndex + 1),
  }
}

const isCompanionBehind = (trail: CompanionTrail, isRunningOff: boolean) =>
  trail.readIndex !== wrapTrailIndex(trail.writeIndex - COMPANION_TRAIL_LAG) ||
  (isRunningOff && trail.readIndex !== trail.writeIndex)

// While the player keeps moving the companion only steps once the entry it stands on is about to be overwritten.
const shouldStepCompanion = (trail: CompanionTrail, hasPlayerMoved: boolean) =>
  !hasPlayerMoved || trail.readIndex === wrapTrailIndex(trail.writeIndex + 1)

export const advanceCompanionTrail = (
  trail: CompanionTrail,
  source: TrailEntry,
  { hasPlayerMoved, isFollowing, isRunningOff }: TrailAdvanceRequest,
): CompanionTrail => {
  const recorded = recordTrailSource(trail, source)
  if (!isFollowing || !isCompanionBehind(recorded, isRunningOff)) {
    return { ...recorded, isAdvancing: false }
  }
  const readIndex = shouldStepCompanion(recorded, hasPlayerMoved)
    ? wrapTrailIndex(recorded.readIndex + 1)
    : recorded.readIndex
  return { ...recorded, isAdvancing: true, readIndex }
}

export const getChicoboEntry = (trail: CompanionTrail): TrailEntry => {
  const entry = trail.entries[trail.readIndex]
  return { ...entry, altitude: Math.min(entry.altitude, CHICOBO_ALTITUDE_LIMIT) }
}
