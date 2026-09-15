const FRAME_BYTES = 16
const SAMPLES_PER_FRAME = 28

const FLAG_END = 0x1
const FLAG_REPEAT = 0x2

// Second-order predictor weights, in 64ths, one pair per filter index.
const PREVIOUS_WEIGHTS = [0, 60, 115, 98, 122]
const OLDER_WEIGHTS = [0, 0, -52, -55, -60]

// Shifts above 12 are reserved and behave as 9 on the hardware.
const MAX_SHIFT = 12
const RESERVED_SHIFT_REPLACEMENT = 9

const INT16_SCALE = 1 / 32768

type DecodedSample = {
  isLooping: boolean
  loopStartIndex: number
  samples: Float32Array
}

const clampToInt16 = (value: number) => Math.max(-32768, Math.min(32767, value))

const readShift = (header: number) => {
  const shift = header & 0x0f
  return shift > MAX_SHIFT ? RESERVED_SHIFT_REPLACEMENT : shift
}

const readFilter = (header: number) => Math.min((header >> 4) & 0x0f, PREVIOUS_WEIGHTS.length - 1)

const countFrames = (data: Uint8Array, startOffset: number) => {
  for (let offset = startOffset; offset + FRAME_BYTES <= data.length; offset += FRAME_BYTES) {
    if (data[offset + 1] & FLAG_END) {
      return (offset - startOffset) / FRAME_BYTES + 1
    }
  }
  return Math.floor((data.length - startOffset) / FRAME_BYTES)
}

// SPU ADPCM: 16-byte frames of a shift/filter byte, a flags byte, then 14 bytes of 4-bit deltas
// fed through a second-order predictor.
export const decodeAdpcm = (data: Uint8Array, startOffset: number, loopOffset: number): DecodedSample | undefined => {
  const frameCount = countFrames(data, startOffset)
  if (frameCount <= 0) {
    return undefined
  }

  const samples = new Float32Array(frameCount * SAMPLES_PER_FRAME)
  let previous = 0
  let older = 0
  let written = 0
  let lastFlags = 0

  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameOffset = startOffset + frame * FRAME_BYTES
    const shift = readShift(data[frameOffset])
    const filter = readFilter(data[frameOffset])
    const previousWeight = PREVIOUS_WEIGHTS[filter]
    const olderWeight = OLDER_WEIGHTS[filter]
    lastFlags = data[frameOffset + 1]

    for (let index = 0; index < SAMPLES_PER_FRAME; index += 1) {
      const byte = data[frameOffset + 2 + (index >> 1)]
      const nibble = index % 2 === 0 ? byte & 0x0f : byte >> 4
      const delta = (((nibble ^ 8) - 8) << 12) >> shift
      const predicted = (previous * previousWeight + older * olderWeight + 32) >> 6
      const sample = clampToInt16(delta + predicted)

      older = previous
      previous = sample
      samples[written] = sample * INT16_SCALE
      written += 1
    }
  }

  const loopFrame = Math.floor((loopOffset - startOffset) / FRAME_BYTES)
  const isLoopStartInSample = loopFrame > 0 && loopFrame < frameCount

  return {
    isLooping: (lastFlags & FLAG_REPEAT) !== 0,
    loopStartIndex: isLoopStartInSample ? loopFrame * SAMPLES_PER_FRAME : 0,
    samples,
  }
}
