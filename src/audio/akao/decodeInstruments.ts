import type { AkaoBank } from './parseAkaoFile'

import { SAMPLE_RATE } from './constants'
import { decodeAdpcm } from './decodeAdpcm'
import { type AdsrEnvelope, decodeAdsr } from './decodeAdsr'

export type AkaoInstrumentSound = {
  // The instrument's own envelope registers, which a channel starts from and the ADSR opcodes
  // then edit field by field.
  adsr1: number
  adsr2: number
  buffer: AudioBuffer
  detuneWeight: number
  envelope: AdsrEnvelope
  isLooping: boolean
  loopStartSeconds: number
  rootKey: number
}

const createBuffer = (audioContext: BaseAudioContext, samples: Float32Array) => {
  const buffer = audioContext.createBuffer(1, samples.length, SAMPLE_RATE)
  buffer.copyToChannel(samples, 0)
  return buffer
}

// Banks carry a few entries that point past the end of their sample data — unused slots the
// authoring tool left behind — so an instrument can legitimately decode to nothing.
export const decodeInstruments = (audioContext: BaseAudioContext, bank: AkaoBank) =>
  bank.instruments.map((instrument) => {
    const sample = decodeAdpcm(bank.sampleData, instrument.sampleOffset, instrument.loopOffset)
    if (!sample) {
      return undefined
    }

    return {
      adsr1: instrument.adsr1,
      adsr2: instrument.adsr2,
      buffer: createBuffer(audioContext, sample.samples),
      detuneWeight: instrument.detuneWeight,
      envelope: decodeAdsr(instrument.adsr1, instrument.adsr2),
      isLooping: sample.isLooping,
      loopStartSeconds: sample.loopStartIndex / SAMPLE_RATE,
      rootKey: instrument.rootKey,
    } satisfies AkaoInstrumentSound
  })
