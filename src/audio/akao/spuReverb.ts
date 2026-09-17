import {
  REVERB_IMPULSE_SECONDS,
  REVERB_RESAMPLE_CENTRE_TAP,
  REVERB_RESAMPLE_TAPS,
  REVERB_TAIL_FLOOR,
  SAMPLE_RATE,
  STUDIO_C_REVERB,
} from './constants'

type ReverbPreset = typeof STUDIO_C_REVERB

type ReverbState = {
  buffer: Int16Array
  current: number
  downsampleHistory: Int32Array[]
  position: number
  upsampleHistory: Int32Array[]
}

const INT16_MIN = -32768
const INT16_MAX = 32767
const IMPULSE_LEVEL = INT16_MAX
const WORDS_PER_OFFSET_UNIT = 4
const BYTES_PER_WORD = 2
const DOWNSAMPLE_HISTORY = 0x40
const UPSAMPLE_HISTORY = 0x20
const DOWNSAMPLE_TAP_SPACING = 2
const UPSAMPLE_CENTRE_TAP = 9
const RESAMPLE_CENTRE_INDEX = 19
const RESAMPLE_SPAN = 38

const clamp16 = (value: number) => Math.max(INT16_MIN, Math.min(INT16_MAX, value))

// Products in the hardware reach past 32 bits, so shifts are done as floored division.
const shiftDown = (value: number, bits: number) => Math.floor(value / 2 ** bits)

const negate16 = (value: number) => (value === INT16_MIN ? INT16_MAX : -value)

// The reflection filter blends by (1 - alpha), which the hardware computes as 32768 - alpha and
// saturates when alpha is the most negative value.
const scaleByComplement = (alpha: number, sample: number) => {
  if (alpha !== INT16_MIN) {
    return sample * (32768 - alpha)
  }
  return sample === INT16_MIN ? 0 : sample * -65536
}

const createReverbState = (preset: ReverbPreset): ReverbState => ({
  buffer: new Int16Array(preset.workAreaBytes / BYTES_PER_WORD),
  current: 0,
  downsampleHistory: [new Int32Array(DOWNSAMPLE_HISTORY * 2), new Int32Array(DOWNSAMPLE_HISTORY * 2)],
  position: 0,
  upsampleHistory: [new Int32Array(UPSAMPLE_HISTORY * 2), new Int32Array(UPSAMPLE_HISTORY * 2)],
})

const getAddress = (state: ReverbState, offset: number, extra = 0) => {
  const length = state.buffer.length
  return (((state.current + offset * WORDS_PER_OFFSET_UNIT + extra) % length) + length) % length
}

const readWork = (state: ReverbState, offset: number, extra = 0) => state.buffer[getAddress(state, offset, extra)]

const writeWork = (state: ReverbState, offset: number, sample: number) => {
  state.buffer[getAddress(state, offset)] = sample
}

const downsample = (history: Int32Array, start: number) => {
  const sum = REVERB_RESAMPLE_TAPS.reduce(
    (total, tap, index) => total + tap * history[start + index * DOWNSAMPLE_TAP_SPACING],
    REVERB_RESAMPLE_CENTRE_TAP * history[start + RESAMPLE_CENTRE_INDEX],
  )
  return clamp16(shiftDown(sum, 15))
}

const upsample = (history: Int32Array, start: number) => {
  const sum = REVERB_RESAMPLE_TAPS.reduce((total, tap, index) => total + tap * history[start + index], 0)
  return clamp16(shiftDown(sum, 14))
}

const runHalfRateChannel = (state: ReverbState, preset: ReverbPreset, side: number, input: number) => {
  const other = side ^ 1
  const scale = (sample: number, coefficient: number) => shiftDown(sample * coefficient, 14)

  const sameSideInput = clamp16(
    shiftDown(
      scale(readWork(state, preset.sameSideSource[side]), preset.wallCoefficient) +
        scale(input, preset.inputVolumes[side]),
      1,
    ),
  )
  const differentSideInput = clamp16(
    shiftDown(
      scale(readWork(state, preset.differentSideSource[other]), preset.wallCoefficient) +
        scale(input, preset.inputVolumes[side]),
      1,
    ),
  )
  const sameSide = clamp16(
    shiftDown(
      scale(sameSideInput, preset.reflectionAlpha) +
        shiftDown(scaleByComplement(preset.reflectionAlpha, readWork(state, preset.sameSideDestination[side], -1)), 14),
      1,
    ),
  )
  const differentSide = clamp16(
    shiftDown(
      scale(differentSideInput, preset.reflectionAlpha) +
        shiftDown(
          scaleByComplement(preset.reflectionAlpha, readWork(state, preset.differentSideDestination[side], -1)),
          14,
        ),
      1,
    ),
  )
  writeWork(state, preset.sameSideDestination[side], sameSide)
  writeWork(state, preset.differentSideDestination[side], differentSide)

  const comb = preset.combSources.reduce(
    (total, sources, index) => total + scale(readWork(state, sources[side]), preset.combCoefficients[index]),
    0,
  )
  const feedbackA = readWork(state, preset.allPassDestinationA[side] - preset.allPassDelayA)
  const feedbackB = readWork(state, preset.allPassDestinationB[side] - preset.allPassDelayB)
  const allPassA = clamp16(shiftDown(comb + scale(feedbackA, negate16(preset.allPassAlpha)), 1))
  const allPassB = clamp16(
    feedbackA + shiftDown(scale(allPassA, preset.allPassAlpha) + scale(feedbackB, negate16(preset.allPassX)), 1),
  )
  writeWork(state, preset.allPassDestinationA[side], allPassA)
  writeWork(state, preset.allPassDestinationB[side], allPassB)

  return clamp16(feedbackB + shiftDown(allPassB * preset.allPassX, 15))
}

// One 44.1 kHz step of the SPU's reverb: resample down, run the half-rate network every other
// sample, and resample back up. Mutates the state in place, the way the hardware's work area is.
const stepReverb = (state: ReverbState, preset: ReverbPreset, input: readonly number[]) => {
  const { position } = state
  state.downsampleHistory.forEach((history, side) => {
    history[position] = input[side]
    history[position | DOWNSAMPLE_HISTORY] = input[side]
  })

  const upsampleIndex = position >> 1
  const upsampleStart = (upsampleIndex - RESAMPLE_CENTRE_INDEX) & (UPSAMPLE_HISTORY - 1)
  const isHalfRateStep = (position & 1) === 1

  if (isHalfRateStep) {
    const reduced = state.downsampleHistory.map((history) =>
      downsample(history, (position - RESAMPLE_SPAN) & (DOWNSAMPLE_HISTORY - 1)),
    )
    reduced.forEach((sample, side) => {
      const output = runHalfRateChannel(state, preset, side, sample)
      state.upsampleHistory[side][upsampleIndex] = output
      state.upsampleHistory[side][upsampleIndex | UPSAMPLE_HISTORY] = output
    })
    state.current = (state.current + 1) % state.buffer.length
  }

  state.position = (position + 1) & (DOWNSAMPLE_HISTORY - 1)

  return state.upsampleHistory.map((history) =>
    isHalfRateStep ? upsample(history, upsampleStart) : history[upsampleStart + UPSAMPLE_CENTRE_TAP],
  )
}

const renderResponse = (preset: ReverbPreset, inputSide: number, length: number) => {
  const state = createReverbState(preset)
  const outputs = [new Float32Array(length), new Float32Array(length)]

  for (let index = 0; index < length; index += 1) {
    const level = index === 0 ? IMPULSE_LEVEL : 0
    const input = inputSide === 0 ? [level, 0] : [0, level]
    const output = stepReverb(state, preset, input)
    outputs[0][index] = output[0] / IMPULSE_LEVEL
    outputs[1][index] = output[1] / IMPULSE_LEVEL
  }
  return outputs
}

const findTailLength = (channels: readonly Float32Array[]) => {
  const lastAudible = channels.reduce((last, samples) => {
    const index = samples.findLastIndex((sample) => Math.abs(sample) > REVERB_TAIL_FLOOR)
    return Math.max(last, index)
  }, 0)
  return lastAudible + 1
}

// The reverb network is fixed and linear apart from saturation the music never reaches, so one
// click through it captures it completely. Channels are left-in to left and right, then right-in
// to left and right, which is the layout a four-channel convolver reads as true stereo.
export const renderReverbImpulse = (preset: ReverbPreset = STUDIO_C_REVERB) => {
  const length = REVERB_IMPULSE_SECONDS * SAMPLE_RATE
  const channels = [...renderResponse(preset, 0, length), ...renderResponse(preset, 1, length)]
  const tailLength = findTailLength(channels)
  return channels.map((samples) => samples.slice(0, tailLength))
}
