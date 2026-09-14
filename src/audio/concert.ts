import { MUSIC_IDS } from '../constants/audio'

const SEGMENTS = [
  { mask: 0x2, musicId: 100 },
  { mask: 0x4, musicId: 101 },
  { mask: 0x8, musicId: 102 },
  { mask: 0xff0, musicId: 103 },
  { mask: 0x1000, musicId: 104 },
  { mask: 0x7e000, musicId: 105 },
  { mask: 0x380000, musicId: 106 },
  { mask: 0x400000, musicId: 107 },
] as const satisfies readonly { mask: number; musicId: keyof typeof MUSIC_IDS }[]

const SELECTOR_MASK = 0x3ffffff

// fhwise13 assembles this value from the band roster the player builds up. The maps that
// request it with a literal are refused and left silent, which the original does by
// comparing the field id.
const ROSTER_ONLY_MASK = 0xfff
const ROSTER_ONLY_FIELD_ID = 'fhwise13'

const getSelectedSegments = (mask: number) => {
  const soloSegment = SEGMENTS.find((segment) => segment.mask === mask)
  if (soloSegment) {
    return [soloSegment]
  }
  return SEGMENTS.filter((segment) => (mask & segment.mask) === segment.mask)
}

export const getConcertSegmentUrls = (rawMask: number, fieldId: string | undefined) => {
  const mask = rawMask & SELECTOR_MASK

  if (mask === ROSTER_ONLY_MASK && fieldId !== ROSTER_ONLY_FIELD_ID) {
    return []
  }

  return getSelectedSegments(mask).map((segment) => MUSIC_IDS[segment.musicId])
}
