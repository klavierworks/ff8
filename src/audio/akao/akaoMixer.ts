import type { AkaoInstrumentSound } from './decodeInstruments'

import { createAkaoVoice } from './akaoVoice'
import { createAutomatedParameter } from './automatedParameter'
import { REVERB_SECONDS } from './constants'

// The original mix cannot clip; this stands in for that headroom.
const LIMITER_THRESHOLD_DB = -6
const LIMITER_RATIO = 20
const LIMITER_ATTACK_SECONDS = 0.003
const LIMITER_RELEASE_SECONDS = 0.25

const REVERB_DECAY_CURVE = 3

type AkaoMixerOptions = {
  audioContext: BaseAudioContext
  destination: AudioNode
  instruments: (AkaoInstrumentSound | undefined)[]
  voiceCount: number
}

// The hardware reverb is a fixed "Studio C" preset chosen once at startup.
const createReverbImpulse = (audioContext: BaseAudioContext) => {
  const length = Math.floor(REVERB_SECONDS * audioContext.sampleRate)
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate)

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / length) ** REVERB_DECAY_CURVE
    }
  }
  return impulse
}

export const createAkaoMixer = ({ audioContext, destination, instruments, voiceCount }: AkaoMixerOptions) => {
  const output = audioContext.createGain()
  const limiter = audioContext.createDynamicsCompressor()
  const dryBus = audioContext.createGain()
  const reverbBus = audioContext.createGain()
  const reverb = audioContext.createConvolver()

  limiter.threshold.value = LIMITER_THRESHOLD_DB
  limiter.knee.value = 0
  limiter.ratio.value = LIMITER_RATIO
  limiter.attack.value = LIMITER_ATTACK_SECONDS
  limiter.release.value = LIMITER_RELEASE_SECONDS

  reverb.buffer = createReverbImpulse(audioContext)
  reverbBus.gain.value = 0

  const outputLevel = createAutomatedParameter(output.gain)
  const reverbLevel = createAutomatedParameter(reverbBus.gain)

  dryBus.connect(limiter)
  reverbBus.connect(reverb)
  reverb.connect(limiter)
  limiter.connect(output)
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
    limiter.disconnect()
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
