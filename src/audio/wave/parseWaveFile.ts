const RIFF_HEADER_SIZE = 12
const CHUNK_HEADER_SIZE = 8
const FORMAT_SIZE = 16
const FORMAT_EXTENSION_SIZE_BYTES = 2
const ADPCM_COEFFICIENT_START = 4

const FORMAT_TAG_OFFSET = 0
const FORMAT_CHANNELS_OFFSET = 2
const FORMAT_SAMPLE_RATE_OFFSET = 4
const FORMAT_BLOCK_ALIGN_OFFSET = 12
const FORMAT_BITS_PER_SAMPLE_OFFSET = 14

const SAMPLE_LOOP_COUNT_OFFSET = 28
const SAMPLE_LOOP_START_OFFSET = 44
const SAMPLE_LOOP_END_OFFSET = 48

export const ADPCM_FORMAT_TAG = 2

export type WaveFile = {
  bitsPerSample: number
  blockAlign: number
  channels: number
  // Paired predictor weights the MS-ADPCM blocks choose between, as the file declares them
  // rather than the codec's defaults.
  coefficients: Int16Array
  data: Uint8Array
  formatTag: number
  sampleCount: number
  sampleLoop: undefined | WaveSampleLoop
  sampleRate: number
}

export type WaveSampleLoop = {
  end: number
  start: number
}

const readFourCharacterCode = (view: DataView, offset: number) =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )

type WaveChunks = Map<string, { length: number; offset: number }>

const readChunks = (view: DataView): WaveChunks => {
  const chunks: WaveChunks = new Map()
  let offset = RIFF_HEADER_SIZE

  while (offset + CHUNK_HEADER_SIZE <= view.byteLength) {
    const id = readFourCharacterCode(view, offset)
    const length = view.getUint32(offset + 4, true)
    chunks.set(id, { length, offset: offset + CHUNK_HEADER_SIZE })
    // Chunks are word aligned and the pad byte is not counted in the length.
    offset += CHUNK_HEADER_SIZE + length + (length & 1)
  }

  return chunks
}

const readCoefficients = (view: DataView, offset: number, length: number) => {
  if (length <= FORMAT_SIZE + FORMAT_EXTENSION_SIZE_BYTES) {
    return new Int16Array(0)
  }

  const extraStart = offset + FORMAT_SIZE + FORMAT_EXTENSION_SIZE_BYTES + ADPCM_COEFFICIENT_START
  const count = (length - FORMAT_SIZE - FORMAT_EXTENSION_SIZE_BYTES - ADPCM_COEFFICIENT_START) / 2
  const coefficients = new Int16Array(count)
  for (let index = 0; index < count; index += 1) {
    coefficients[index] = view.getInt16(extraStart + index * 2, true)
  }
  return coefficients
}

// The sampler chunk counts a loop's end as the last sample played, where everything downstream
// wants the sample after it.
const readSampleLoop = (view: DataView, chunks: WaveChunks) => {
  const chunk = chunks.get('smpl')
  if (!chunk || view.getUint32(chunk.offset + SAMPLE_LOOP_COUNT_OFFSET, true) === 0) {
    return undefined
  }
  return {
    end: view.getUint32(chunk.offset + SAMPLE_LOOP_END_OFFSET, true) + 1,
    start: view.getUint32(chunk.offset + SAMPLE_LOOP_START_OFFSET, true),
  }
}

const countPcmSamples = (dataLength: number, bitsPerSample: number, channels: number) =>
  dataLength / Math.max(1, bitsPerSample / 8) / Math.max(1, channels)

export const parseWaveFile = (bytes: ArrayBuffer): WaveFile => {
  const view = new DataView(bytes)
  if (readFourCharacterCode(view, 0) !== 'RIFF' || readFourCharacterCode(view, 8) !== 'WAVE') {
    throw new Error('Not a RIFF WAVE file')
  }

  const chunks = readChunks(view)
  const format = chunks.get('fmt ')
  const data = chunks.get('data')
  if (!format || !data) {
    throw new Error('WAVE file has no format or no data')
  }

  const bitsPerSample = view.getUint16(format.offset + FORMAT_BITS_PER_SAMPLE_OFFSET, true)
  const channels = view.getUint16(format.offset + FORMAT_CHANNELS_OFFSET, true)
  const fact = chunks.get('fact')

  return {
    bitsPerSample,
    blockAlign: view.getUint16(format.offset + FORMAT_BLOCK_ALIGN_OFFSET, true),
    channels,
    coefficients: readCoefficients(view, format.offset, format.length),
    data: new Uint8Array(bytes, data.offset, data.length),
    formatTag: view.getUint16(format.offset + FORMAT_TAG_OFFSET, true),
    // A compressed stream cannot have its length worked out from its byte count, so it carries
    // the sample count alongside.
    sampleCount: fact ? view.getUint32(fact.offset, true) : countPcmSamples(data.length, bitsPerSample, channels),
    sampleLoop: readSampleLoop(view, chunks),
    sampleRate: view.getUint32(format.offset + FORMAT_SAMPLE_RATE_OFFSET, true),
  }
}
