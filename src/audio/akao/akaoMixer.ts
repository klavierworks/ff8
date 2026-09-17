import type { AkaoInstrumentSound } from './decodeInstruments'

import { createAkaoVoice } from './akaoVoice'
import { createAutomatedParameter } from './automatedParameter'
import { SAMPLE_RATE } from './constants'
import { renderReverbImpulse } from './spuReverb'

type AkaoMixerOptions = {
  audioContext: BaseAudioContext
  destination: AudioNode
  instruments: (AkaoInstrumentSound | undefined)[]
  voiceCount: number
}

const resampleLinear = (samples: Float32Array, fromRate: number, toRate: number) => {
  if (fromRate === toRate) {
    return samples
  }
  const ratio = fromRate / toRate
  const length = Math.floor(samples.length / ratio)
  return Float32Array.from({ length }, (_, index) => {
    const position = index * ratio
    const before = Math.floor(position)
    const after = Math.min(before + 1, samples.length - 1)
    return samples[before] + (samples[after] - samples[before]) * (position - before)
  })
}

// The response is rendered once at the SPU's own rate, then fitted to whichever rate the context
// runs at, because a convolver only accepts a buffer at its context's rate.
const reverbBuffersByContext = new WeakMap<BaseAudioContext, AudioBuffer>()

const getReverbBuffer = (audioContext: BaseAudioContext) => {
  const cached = reverbBuffersByContext.get(audioContext)
  if (cached) {
    return cached
  }
  const channels = renderReverbImpulse().map((samples) => resampleLinear(samples, SAMPLE_RATE, audioContext.sampleRate))
  const buffer = audioContext.createBuffer(channels.length, channels[0].length, audioContext.sampleRate)
  channels.forEach((samples, channel) => buffer.copyToChannel(samples, channel))
  reverbBuffersByContext.set(audioContext, buffer)
  return buffer
}

export const createAkaoMixer = ({ audioContext, destination, instruments, voiceCount }: AkaoMixerOptions) => {
  const output = audioContext.createGain()
  const dryBus = audioContext.createGain()
  const reverbBus = audioContext.createGain()
  const reverb = audioContext.createConvolver()

  reverb.normalize = false
  reverb.buffer = getReverbBuffer(audioContext)
  reverbBus.gain.value = 0

  const outputLevel = createAutomatedParameter(output.gain)
  const reverbLevel = createAutomatedParameter(reverbBus.gain)

  dryBus.connect(output)
  reverbBus.connect(reverb)
  reverb.connect(output)
  output.connect(destination)

  const channels = Array.from({ length: voiceCount }, () =>
    createAkaoVoice({ audioContext, dryBus, instruments, reverbBus }),
  )

  // Pitch modulation reads the voice before this one, so the chain is wired in channel order once.
  channels.slice(1).forEach((channel, index) => {
    channels[index].modulationOutput.connect(channel.pitchModulationInput)
  })

  const disconnect = () => {
    channels.forEach((channel) => channel.disconnect())
    dryBus.disconnect()
    reverbBus.disconnect()
    reverb.disconnect()
    output.disconnect()
  }

  return {
    disconnect,
    outputLevel,
    setReverbDepth: (depth: number, time: number, rampSeconds: number) => reverbLevel.rampTo(depth, time, rampSeconds),
    stopAll: () => channels.forEach((channel) => channel.stop()),
    voices: channels.map((channel) => channel.voice),
  }
}
