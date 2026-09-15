import { INSTRUMENT_ENTRY_SIZE } from './constants'

// "AKAO" read as a little-endian word.
const AKAO_MAGIC = 0x4f414b41

const SEQUENCE_SONG_ID = 0x04
const SEQUENCE_LENGTH = 0x06
const SEQUENCE_MASTER_VOLUME = 0x10
const SEQUENCE_BANK_ID = 0x14
const SEQUENCE_CHANNEL_MASK = 0x20
const SEQUENCE_INSTRUMENT_MAPS = 0x30
const SEQUENCE_DRUM_TABLE = 0x34
const SEQUENCE_CHANNEL_TABLE = 0x40

// The instrument-map table is a fixed 16 slots of self-relative offsets, with the records packed
// immediately after it. A negative slot offset means the slot is unused.
const INSTRUMENT_MAP_SLOTS = 16
const INSTRUMENT_MAP_RECORDS = 0x20
const INSTRUMENT_MAP_RECORD_SIZE = 8
const MAX_REGIONS_PER_MAP = 32

// The drum table is indexed by the note's own semitone, so it is as long as the keyboard. The
// driver does not bound-check the index, and a table can stop short of 128 entries.
const DRUM_RECORD_SIZE = 8
const DRUM_RECORD_COUNT = 128

const BANK_ID = 0x04
const BANK_SAMPLE_BYTES = 0x14
// Where in the driver's runtime instrument table this bank loads. Music banks all carry 0x40; the
// two resident banks carry lower bases and sit below the track's own instruments.
const BANK_INSTRUMENT_BASE = 0x18
const BANK_INSTRUMENT_COUNT = 0x1c
// The loader takes the instrument table from a fixed offset rather than from any header field.
const BANK_INSTRUMENT_TABLE = 0x40

export type AkaoBank = {
  id: number
  // Where this bank's first instrument lands in the runtime table every loaded bank shares.
  instrumentBase: number
  instruments: AkaoInstrument[]
  sampleData: Uint8Array
}

export type AkaoDrumRecord = {
  attackRate: number
  hasReverb: boolean
  instrumentOperand: number
  pan: number
  releaseRate: number
  semitone: number
  sustainMode: number
  sustainRate: number
  volumeScale: number
}

export type AkaoInstrument = {
  adsr1: number
  adsr2: number
  detuneWeight: number
  loopOffset: number
  rootKey: number
  sampleOffset: number
}

export type AkaoInstrumentRegion = {
  attackRate: number
  highKey: number
  instrumentOperand: number
  lowKey: number
  releaseRate: number
  sustainMode: number
  sustainRate: number
  volumeScale: number
}

export type AkaoSequence = {
  bankId: number
  // Offsets into `stream`, one per channel, in channel-mask order.
  channelStartOffsets: number[]
  drumRecords: (AkaoDrumRecord | undefined)[]
  instrumentMaps: (AkaoInstrumentRegion[] | undefined)[]
  masterVolume: number
  songId: number
  stream: Uint8Array
}

type AkaoFile = {
  bank: AkaoBank | undefined
  sequence: AkaoSequence
}

const countSetBits = (mask: number) => {
  let count = 0
  for (let bit = 0; bit < 32; bit += 1) {
    if (mask & (1 << bit)) {
      count += 1
    }
  }
  return count
}

const hasAkaoMagic = (view: DataView, offset: number) =>
  offset + 4 <= view.byteLength && view.getUint32(offset, true) === AKAO_MAGIC

const readBlockDirectory = (view: DataView) => {
  const blockCount = view.getUint32(0, true)
  return Array.from({ length: blockCount }, (_, index) => ({
    offset: view.getUint32(4 + index * 8, true),
    size: view.getUint32(8 + index * 8, true),
  }))
}

const parseChannelStartOffsets = (view: DataView, blockOffset: number) => {
  const mask = view.getUint32(blockOffset + SEQUENCE_CHANNEL_MASK, true)
  return Array.from({ length: countSetBits(mask) }, (_, index) => {
    const entry = SEQUENCE_CHANNEL_TABLE + index * 2
    return entry + view.getUint16(blockOffset + entry, true)
  })
}

// A map's records run until one turns up with no envelope mode, which is the driver's own
// end-of-chain test.
const parseInstrumentRegions = (view: DataView, recordsOffset: number): AkaoInstrumentRegion[] => {
  const regions: AkaoInstrumentRegion[] = []

  for (let index = 0; index < MAX_REGIONS_PER_MAP; index += 1) {
    const record = recordsOffset + index * INSTRUMENT_MAP_RECORD_SIZE
    if (record + INSTRUMENT_MAP_RECORD_SIZE > view.byteLength || view.getUint8(record + 5) === 0) {
      return regions
    }
    regions.push({
      attackRate: view.getUint8(record + 3),
      highKey: view.getUint8(record + 2),
      instrumentOperand: view.getUint8(record),
      lowKey: view.getUint8(record + 1),
      releaseRate: view.getUint8(record + 6),
      sustainMode: view.getUint8(record + 5),
      sustainRate: view.getUint8(record + 4),
      volumeScale: view.getUint8(record + 7),
    })
  }
  return regions
}

const parseInstrumentMaps = (view: DataView, blockOffset: number) => {
  const tableOffset = view.getUint32(blockOffset + SEQUENCE_INSTRUMENT_MAPS, true)
  if (tableOffset === 0) {
    return []
  }

  const table = blockOffset + SEQUENCE_INSTRUMENT_MAPS + tableOffset
  return Array.from({ length: INSTRUMENT_MAP_SLOTS }, (_, slot) => {
    const entry = view.getInt16(table + slot * 2, true)
    return entry < 0 ? undefined : parseInstrumentRegions(view, table + entry + INSTRUMENT_MAP_RECORDS)
  })
}

const parseDrumRecords = (view: DataView, blockOffset: number): (AkaoDrumRecord | undefined)[] => {
  const tableOffset = view.getUint32(blockOffset + SEQUENCE_DRUM_TABLE, true)
  if (tableOffset === 0) {
    return []
  }

  const table = blockOffset + SEQUENCE_DRUM_TABLE + tableOffset
  return Array.from({ length: DRUM_RECORD_COUNT }, (_unused, semitone) => {
    const record = table + semitone * DRUM_RECORD_SIZE
    if (record + DRUM_RECORD_SIZE > view.byteLength) {
      return undefined
    }
    const pan = view.getUint8(record + 7)
    return {
      attackRate: view.getUint8(record + 2),
      hasReverb: (pan & 0x80) !== 0,
      instrumentOperand: view.getUint8(record),
      pan: pan & 0x7f,
      releaseRate: view.getUint8(record + 5),
      semitone: view.getUint8(record + 1),
      sustainMode: view.getUint8(record + 4),
      sustainRate: view.getUint8(record + 3),
      volumeScale: view.getUint8(record + 6),
    }
  })
}

const parseSequenceBlock = (buffer: ArrayBuffer, view: DataView, blockOffset: number): AkaoSequence => {
  const length = view.getUint16(blockOffset + SEQUENCE_LENGTH, true)
  return {
    bankId: view.getUint32(blockOffset + SEQUENCE_BANK_ID, true),
    channelStartOffsets: parseChannelStartOffsets(view, blockOffset),
    drumRecords: parseDrumRecords(view, blockOffset),
    instrumentMaps: parseInstrumentMaps(view, blockOffset),
    masterVolume: view.getUint32(blockOffset + SEQUENCE_MASTER_VOLUME, true),
    songId: view.getUint16(blockOffset + SEQUENCE_SONG_ID, true),
    stream: new Uint8Array(buffer, blockOffset, 4 + length),
  }
}

const parseInstrument = (view: DataView, entryOffset: number): AkaoInstrument => ({
  adsr1: view.getUint16(entryOffset + 12, true),
  adsr2: view.getUint16(entryOffset + 14, true),
  detuneWeight: view.getInt16(entryOffset + 8, true),
  loopOffset: view.getUint32(entryOffset + 4, true),
  rootKey: view.getInt16(entryOffset + 10, true),
  sampleOffset: view.getUint32(entryOffset, true),
})

const parseBankBlock = (buffer: ArrayBuffer, view: DataView, blockOffset: number): AkaoBank => {
  const tableOffset = blockOffset + BANK_INSTRUMENT_TABLE
  const instrumentCount = view.getUint32(blockOffset + BANK_INSTRUMENT_COUNT, true)
  const sampleOffset = tableOffset + instrumentCount * INSTRUMENT_ENTRY_SIZE
  // A few banks round their byte count up past the end of the file, the SPU upload being sized in
  // whole transfer units rather than to the last sample.
  const sampleBytes = Math.min(view.getUint32(blockOffset + BANK_SAMPLE_BYTES, true), buffer.byteLength - sampleOffset)

  return {
    id: view.getUint16(blockOffset + BANK_ID, true),
    instrumentBase: view.getUint32(blockOffset + BANK_INSTRUMENT_BASE, true),
    instruments: Array.from({ length: instrumentCount }, (_, index) =>
      parseInstrument(view, tableOffset + index * INSTRUMENT_ENTRY_SIZE),
    ),
    sampleData: new Uint8Array(buffer, sampleOffset, sampleBytes),
  }
}

// A resident bank is a bare bank block rather than a track's container, so it starts at the magic
// with no block directory in front of it.
export const parseAkaoBank = (buffer: ArrayBuffer): AkaoBank => {
  const view = new DataView(buffer)
  if (!hasAkaoMagic(view, 0)) {
    throw new Error('Not an AKAO bank file')
  }
  return parseBankBlock(buffer, view, 0)
}

// One AKAO file holds a sequence block and, for every track but the silent one, the sample bank
// that sequence plays. The trailing block of a bankless track is build-tool leftovers, not AKAO.
export const parseAkaoFile = (buffer: ArrayBuffer): AkaoFile => {
  const view = new DataView(buffer)
  const blocks = readBlockDirectory(view)
  const [sequenceBlock, bankBlock] = blocks

  if (!sequenceBlock || !hasAkaoMagic(view, sequenceBlock.offset)) {
    throw new Error('Not an AKAO music file')
  }

  return {
    bank:
      bankBlock && hasAkaoMagic(view, bankBlock.offset) ? parseBankBlock(buffer, view, bankBlock.offset) : undefined,
    sequence: parseSequenceBlock(buffer, view, sequenceBlock.offset),
  }
}
