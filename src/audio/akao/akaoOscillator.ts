import type { AutomatedParameter } from './automatedParameter'
import type { AkaoModulation } from './types'

import { createAutomatedParameter } from './automatedParameter'
import { INTERRUPT_SECONDS } from './constants'
import { LFO_WAVEFORMS } from './lfoWaveforms'

// The waveform steps are Q15, and a buffer has to declare a sample rate the audio clock will
// accept, so the shape is laid down at the lowest one and played back slowly enough that each
// step lasts as long as the sequence asked for.
const Q15_SCALE = 1 / 32768
const LFO_BUFFER_RATE = 8000

export type AkaoOscillator = {
  delaySeconds: number
  // In the modulated parameter's own units.
  depth: AutomatedParameter
  dispose: () => void
  modulation: AkaoModulation
  output: GainNode
}

const createWaveformBuffer = (audioContext: BaseAudioContext, waveformIndex: number) => {
  const waveform = LFO_WAVEFORMS[waveformIndex % LFO_WAVEFORMS.length]
  const buffer = audioContext.createBuffer(1, waveform.steps.length, LFO_BUFFER_RATE)
  const samples = buffer.getChannelData(0)

  waveform.steps.forEach((step, index) => {
    samples[index] = step * Q15_SCALE
  })
  return { buffer, loopLength: Math.min(waveform.loopLength, waveform.steps.length) }
}

// The waveform walker runs on the driver's 240 Hz interrupt rather than on the musical tick, so
// the rate operand counts interrupts and an oscillator keeps its speed when the tempo changes.
// Its delay counts musical ticks, because that one is stepped by the sequencer.
export const createAkaoOscillator = (
  audioContext: BaseAudioContext,
  modulation: AkaoModulation,
  time: number,
  delaySeconds = 0,
): AkaoOscillator => {
  const { buffer, loopLength } = createWaveformBuffer(audioContext, modulation.waveformIndex)
  const source = audioContext.createBufferSource()
  const output = audioContext.createGain()
  const stepSeconds = Math.max(modulation.rateInterrupts, 1) * INTERRUPT_SECONDS

  source.buffer = buffer
  source.loop = true
  source.loopStart = (buffer.length - loopLength) / LFO_BUFFER_RATE
  source.loopEnd = buffer.length / LFO_BUFFER_RATE
  source.playbackRate.value = 1 / (LFO_BUFFER_RATE * stepSeconds)

  output.gain.value = 0
  source.connect(output)
  source.start(time + delaySeconds)

  return {
    delaySeconds,
    depth: createAutomatedParameter(output.gain),
    dispose: () => {
      source.stop()
      source.disconnect()
      output.disconnect()
    },
    modulation,
    output,
  }
}

export const isSameOscillatorShape = (current: AkaoModulation, next: AkaoModulation) =>
  current.waveformIndex === next.waveformIndex &&
  current.rateInterrupts === next.rateInterrupts &&
  current.delayTicks === next.delayTicks
