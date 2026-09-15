import {
  NOISE_BUFFER_SECONDS,
  NOISE_COUNTER_PERIOD,
  NOISE_SHIFT_DIVISOR,
  NOISE_STEP_BASE,
  NOISE_STEP_MASK,
  SAMPLE_RATE,
} from './constants'

// How often the SPU's noise generator picks a new level. Its counter runs at the sample rate,
// steps by 4 to 7 and reloads with 0x20000 shifted down, so the 6-bit clock covers everything
// from a slow rattle to a hiss.
const getNoiseLevelRate = (clock: number) => {
  const shift = Math.floor(clock / NOISE_SHIFT_DIVISOR)
  const step = NOISE_STEP_BASE + (clock & NOISE_STEP_MASK)
  return (SAMPLE_RATE * step) / (NOISE_COUNTER_PERIOD / 2 ** shift)
}

// The playback rate that lays one buffer sample down per noise level.
export const getNoisePlaybackRate = (clock: number) => getNoiseLevelRate(clock) / SAMPLE_RATE

// A second of white noise a voice builds once and then plays at whatever fraction of the sample
// rate the noise clock asks for, which is how the hardware's noise source changes character.
export const createNoiseBuffer = (audioContext: BaseAudioContext) => {
  const buffer = audioContext.createBuffer(1, SAMPLE_RATE * NOISE_BUFFER_SECONDS, SAMPLE_RATE)
  const samples = buffer.getChannelData(0)

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1
  }
  return buffer
}
