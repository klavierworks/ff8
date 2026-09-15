import { AKAO_MUSIC_ID_COUNT, getAkaoTrackUrl, RESIDENT_BANK_URLS } from './constants'
import { type AkaoInstrumentSound, decodeInstruments } from './decodeInstruments'
import { type AkaoBank, type AkaoSequence, parseAkaoBank, parseAkaoFile } from './parseAkaoFile'

export type AkaoTrackData = {
  instruments: (AkaoInstrumentSound | undefined)[]
  sequence: AkaoSequence
}

const trackCache = new Map<number, Promise<AkaoTrackData>>()

const fetchBuffer = async (url: string, description: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to load ${description}: ${response.status}`)
  }
  return response.arrayBuffer()
}

// Every bank loads at the base its own block names, so a sequence addresses a resident bank and
// its own bank with the same kind of operand.
const placeBank = (table: (AkaoInstrumentSound | undefined)[], audioContext: BaseAudioContext, bank: AkaoBank) => {
  const placed = [...table]
  decodeInstruments(audioContext, bank).forEach((instrument, index) => {
    placed[bank.instrumentBase + index] = instrument
  })
  return placed
}

const residentBanksByContext = new WeakMap<BaseAudioContext, Promise<(AkaoInstrumentSound | undefined)[]>>()

const loadResidentBanks = (audioContext: BaseAudioContext) => {
  const cached = residentBanksByContext.get(audioContext)
  if (cached) {
    return cached
  }

  const loading = Promise.all(
    RESIDENT_BANK_URLS.map(async (url) => parseAkaoBank(await fetchBuffer(url, `AKAO resident bank ${url}`))),
  ).then((banks) =>
    banks.reduce<(AkaoInstrumentSound | undefined)[]>((table, bank) => placeBank(table, audioContext, bank), []),
  )

  residentBanksByContext.set(audioContext, loading)
  loading.catch(() => residentBanksByContext.delete(audioContext))
  return loading
}

const fetchTrackData = async (audioContext: BaseAudioContext, musicId: number): Promise<AkaoTrackData> => {
  const [buffer, residentInstruments] = await Promise.all([
    fetchBuffer(getAkaoTrackUrl(musicId), `AKAO music ${musicId}`),
    loadResidentBanks(audioContext),
  ])

  const { bank, sequence } = parseAkaoFile(buffer)
  return {
    instruments: bank ? placeBank(residentInstruments, audioContext, bank) : [...residentInstruments],
    sequence,
  }
}

// Ids past the archive are the PC build's own additions and never existed as AKAO sequences.
export const hasAkaoTrack = (musicId: number) => musicId >= 0 && musicId < AKAO_MUSIC_ID_COUNT

// The hardware holds one sample bank at a time; each track keeps its own so a crossfade can run
// two at once.
export const loadAkaoTrack = (audioContext: BaseAudioContext, musicId: number) => {
  const cached = trackCache.get(musicId)
  if (cached) {
    return cached
  }

  const loading = fetchTrackData(audioContext, musicId)
  trackCache.set(musicId, loading)
  loading.catch(() => trackCache.delete(musicId))
  return loading
}
