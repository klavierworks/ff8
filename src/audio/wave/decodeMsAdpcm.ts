import type { WaveFile } from './parseWaveFile'

// MS-ADPCM keeps four bits per sample: each nibble is a correction to what the previous two
// samples predict, scaled by a step size the nibble itself then adjusts. Every block restarts the
// prediction, which is why a block carries two whole samples before its nibbles.
const PREAMBLE_BYTES = 7
const PREAMBLE_SAMPLES = 2
const PREDICTOR_SCALE = 256
const MINIMUM_DELTA = 16
const NIBBLE_SIGN_BIT = 8
const NIBBLE_RANGE = 16

export const SIXTEEN_BIT_SCALE = 32768

const SAMPLE_MINIMUM = -SIXTEEN_BIT_SCALE
const SAMPLE_MAXIMUM = SIXTEEN_BIT_SCALE - 1

// How far the step size moves for each nibble value: a large correction widens it, a small one
// narrows it.
const ADAPTATION_TABLE = [230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230]

// The codec's own weights, used for a file that declares none of its own.
const DEFAULT_COEFFICIENTS = [256, 0, 512, -256, 0, 0, 192, 64, 240, 0, 460, -208, 392, -232]

type AdpcmChannel = {
  coefficient1: number
  coefficient2: number
  delta: number
  sample1: number
  sample2: number
}

const clampSample = (value: number) => Math.max(SAMPLE_MINIMUM, Math.min(SAMPLE_MAXIMUM, value))

const toSignedNibble = (nibble: number) => (nibble >= NIBBLE_SIGN_BIT ? nibble - NIBBLE_RANGE : nibble)

const getCoefficients = (wave: WaveFile) =>
  wave.coefficients.length > 0 ? wave.coefficients : Int16Array.from(DEFAULT_COEFFICIENTS)

const readBlockChannels = (wave: WaveFile, block: Uint8Array, view: DataView): AdpcmChannel[] => {
  const coefficients = getCoefficients(wave)

  // A block opens with every channel's predictor choice, then every channel's step size, then
  // their two starting samples, each field grouped across the channels rather than per channel.
  return Array.from({ length: wave.channels }, (_unused, channel) => {
    const predictor = Math.min(block[channel], coefficients.length / 2 - 1)
    const deltaOffset = wave.channels + channel * 2
    const sample1Offset = wave.channels * 3 + channel * 2
    const sample2Offset = wave.channels * 5 + channel * 2

    return {
      coefficient1: coefficients[predictor * 2],
      coefficient2: coefficients[predictor * 2 + 1],
      delta: view.getInt16(deltaOffset, true),
      sample1: view.getInt16(sample1Offset, true),
      sample2: view.getInt16(sample2Offset, true),
    }
  })
}

const decodeNibble = (_channel: AdpcmChannel, nibble: number) => {
  const weighted = _channel.sample1 * _channel.coefficient1 + _channel.sample2 * _channel.coefficient2
  const sample = clampSample(Math.trunc(weighted / PREDICTOR_SCALE) + toSignedNibble(nibble) * _channel.delta)

  _channel.sample2 = _channel.sample1
  _channel.sample1 = sample
  _channel.delta = Math.max(MINIMUM_DELTA, Math.trunc((ADAPTATION_TABLE[nibble] * _channel.delta) / PREDICTOR_SCALE))
  return sample
}

const countBlockSamples = (wave: WaveFile, blockLength: number) => {
  const preamble = PREAMBLE_BYTES * wave.channels
  if (blockLength <= preamble) {
    return 0
  }
  return ((blockLength - preamble) * 2) / wave.channels + PREAMBLE_SAMPLES
}

const decodeBlock = (wave: WaveFile, block: Uint8Array, _channels: Float32Array[], start: number) => {
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
  const state = readBlockChannels(wave, block, view)
  const total = countBlockSamples(wave, block.length)

  state.forEach((channel, index) => {
    _channels[index][start] = channel.sample2 / SIXTEEN_BIT_SCALE
    _channels[index][start + 1] = channel.sample1 / SIXTEEN_BIT_SCALE
  })

  const nibbleStart = PREAMBLE_BYTES * wave.channels
  for (let sample = PREAMBLE_SAMPLES; sample < total; sample += 1) {
    for (let index = 0; index < wave.channels; index += 1) {
      const nibbleIndex = (sample - PREAMBLE_SAMPLES) * wave.channels + index
      const byte = block[nibbleStart + (nibbleIndex >> 1)]
      const nibble = nibbleIndex & 1 ? byte & 0x0f : byte >> 4
      _channels[index][start + sample] = decodeNibble(state[index], nibble) / SIXTEEN_BIT_SCALE
    }
  }

  return total
}

export const decodeMsAdpcm = (wave: WaveFile): Float32Array[] => {
  const channels = Array.from({ length: wave.channels }, () => new Float32Array(wave.sampleCount))
  let written = 0

  for (let offset = 0; offset + PREAMBLE_BYTES * wave.channels <= wave.data.length; offset += wave.blockAlign) {
    const block = wave.data.subarray(offset, Math.min(offset + wave.blockAlign, wave.data.length))
    written += decodeBlock(wave, block, channels, written)
  }

  return channels
}
