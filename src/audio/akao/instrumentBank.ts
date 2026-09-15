import type { AkaoInstrumentRegion } from './parseAkaoFile'

// Which entry of a keyed instrument map covers a note. The driver walks the chain until it finds
// the record whose span reaches the key, so a key past the end lands on the last record.
export const getInstrumentRegion = (regions: AkaoInstrumentRegion[], semitone: number) =>
  regions.find((candidate) => semitone <= candidate.highKey) ?? regions[regions.length - 1]
