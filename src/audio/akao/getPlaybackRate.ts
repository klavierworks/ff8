import { MAX_PITCH, SEMITONE_PITCH_RATIOS, SEMITONES_PER_OCTAVE, UNITY_PITCH } from './constants'

// The driver blends an instrument's fine-tune weight onto the semitone ratio, scaling up and
// down by different amounts depending on its sign.
const DETUNE_UP_SCALE = 0x8000
const DETUNE_DOWN_SCALE = 0x10000

// A channel's fine tuning scales the pitch it would otherwise play, by a different fraction
// depending on its sign — the same asymmetry the instrument's own weight has.
const CHANNEL_DETUNE_UP_SCALE = 128
const CHANNEL_DETUNE_DOWN_SCALE = 256

type TunedInstrument = {
  detuneWeight: number
  rootKey: number
}

// How fast to play an instrument's recording for a given note: the ratio between the note and the
// pitch the sample was recorded at, fine-tuned by the instrument's own weight. 1 is 44100 Hz, and
// the SPU's pitch register cannot express more than four times that.
export const getPlaybackRate = (instrument: TunedInstrument, semitone: number, channelDetune = 0) => {
  const semitones = semitone - instrument.rootKey
  const octaves = Math.floor(semitones / SEMITONES_PER_OCTAVE)
  const ratio = SEMITONE_PITCH_RATIOS[semitones - octaves * SEMITONES_PER_OCTAVE] / UNITY_PITCH
  const detune = 1 + instrument.detuneWeight / (instrument.detuneWeight >= 0 ? DETUNE_UP_SCALE : DETUNE_DOWN_SCALE)

  const tuning = 1 + channelDetune / (channelDetune >= 0 ? CHANNEL_DETUNE_UP_SCALE : CHANNEL_DETUNE_DOWN_SCALE)

  return Math.min(ratio * 2 ** octaves * detune * tuning, MAX_PITCH / UNITY_PITCH)
}
