import type { WaveFile, WaveSampleLoop } from './parseWaveFile'

import { decodeMsAdpcm, SIXTEEN_BIT_SCALE } from './decodeMsAdpcm'
import { ADPCM_FORMAT_TAG, parseWaveFile } from './parseWaveFile'

const EIGHT_BIT_BIAS = 128

export type DecodedWave = {
  buffer: AudioBuffer
  sampleLoop: undefined | WaveSampleLoop
}

const decodeEightBitPcm = (wave: WaveFile, channel: number) => {
  const samples = new Float32Array(wave.sampleCount)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (wave.data[index * wave.channels + channel] - EIGHT_BIT_BIAS) / EIGHT_BIT_BIAS
  }
  return samples
}

const decodeSixteenBitPcm = (wave: WaveFile, channel: number) => {
  const view = new DataView(wave.data.buffer, wave.data.byteOffset, wave.data.byteLength)
  const samples = new Float32Array(wave.sampleCount)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16((index * wave.channels + channel) * 2, true) / SIXTEEN_BIT_SCALE
  }
  return samples
}

const decodeChannels = (wave: WaveFile) => {
  if (wave.formatTag === ADPCM_FORMAT_TAG) {
    return decodeMsAdpcm(wave)
  }
  const decodeChannel = wave.bitsPerSample === 8 ? decodeEightBitPcm : decodeSixteenBitPcm
  return Array.from({ length: wave.channels }, (_unused, channel) => decodeChannel(wave, channel))
}

// Decoded here rather than through `decodeAudioData` because the sound effects keep the MS-ADPCM
// compression the PC build shipped, which browsers do not read.
export const decodeWaveFile = (audioContext: BaseAudioContext, bytes: ArrayBuffer): DecodedWave => {
  const wave = parseWaveFile(bytes)
  const channels = decodeChannels(wave)
  const buffer = audioContext.createBuffer(wave.channels, Math.max(1, wave.sampleCount), wave.sampleRate)

  channels.forEach((samples, channel) => buffer.copyToChannel(samples, channel))
  return { buffer, sampleLoop: wave.sampleLoop }
}
