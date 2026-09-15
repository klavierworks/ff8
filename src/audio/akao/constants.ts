// ─── Sequencer: timing ───

// The PSX driver runs the sequencer from a hardware timer at a fixed 240 Hz, never from the
// frame rate. Each interrupt adds the track's tempo to a 16-bit accumulator and the musical
// tick happens on overflow, so the musical rate is 240 * tempo / 65536 Hz.
export const INTERRUPT_HZ = 240
export const INTERRUPT_SECONDS = 1 / INTERRUPT_HZ
export const TEMPO_ACCUMULATOR_LIMIT = 0x10000
export const DEFAULT_TEMPO = 26214

// Indexed by the low half of a note byte: halvings from a whole note, then the triplet series.
export const NOTE_DURATION_TICKS = [192, 96, 48, 24, 12, 6, 3, 32, 16, 8, 4]
export const DURATIONS_PER_PITCH = NOTE_DURATION_TICKS.length

// Notes key off early so repeated notes are re-articulated rather than running together.
export const NOTE_GATE_SHORTENING_TICKS = 2

// The gate counter is a 16-bit register that keeps counting past zero and only keys the note off
// on an exact zero, so a note whose gate was never reloaded simply runs on.
export const GATE_COUNTER_LIMIT = 0x10000

// ─── Sequence: event stream layout ───

export const TIE_RANGE_START = 0x84
// Rests nominally run to 0x99, one per table length, but the driver indexes the table with the
// event code modulo its size, so 0x9A-0x9F wrap round and are rests of the first six lengths.
export const REST_RANGE_START = 0x8f
export const CONTROL_RANGE_START = 0xa0

export const SEQUENCE_OPCODES = {
  ADSR_ATTACK_MODE: 0xb7,
  ADSR_ATTACK_RATE: 0xad,
  ADSR_DECAY_AND_SUSTAIN_LEVEL: 0xb0,
  ADSR_DECAY_RATE: 0xae,
  ADSR_RELEASE_MODE: 0xbf,
  ADSR_RELEASE_RATE: 0xb2,
  ADSR_RESET: 0xb3,
  ADSR_SUSTAIN_LEVEL: 0xaf,
  ADSR_SUSTAIN_MODE: 0xbb,
  ADSR_SUSTAIN_RATE: 0xb1,
  COPY_PITCH_OFF: 0xd5,
  COPY_PITCH_ON: 0xd4,
  COPY_VOLUME_OFF: 0xd7,
  COPY_VOLUME_ON: 0xd6,
  END: 0xa0,
  // Opcodes 0xE1-0xEF and 0xFF all dispatch to the same end-of-track handler as 0xA0.
  END_ALIAS: 0xff,
  END_RANGE_END: 0xef,
  END_RANGE_START: 0xe1,
  EXTENDED: 0xfe,
  JUMP_BACK: 0xca,
  LOOP_END: 0xc9,
  LOOP_START: 0xc8,
  NOISE_CLOCK: 0xac,
  NOISE_OFF: 0xc5,
  NOISE_ON: 0xc4,
  NOISE_ON_THEN_TOGGLE: 0xce,
  NOISE_TOGGLE_AFTER: 0xcf,
  NOTE_WITH_DURATION_END: 0xfb,
  NOTE_WITH_DURATION_START: 0xf0,
  OCTAVE_DOWN: 0xa7,
  OCTAVE_UP: 0xa6,
  OVERWRITE_NOTE_LENGTH: 0xa2,
  PAN_OSCILLATION_DEPTH: 0xbd,
  PAN_OSCILLATION_OFF: 0xbe,
  PAN_OSCILLATION_ON: 0xbc,
  PITCH_MODULATION_OFF: 0xc7,
  PITCH_MODULATION_ON: 0xc6,
  PITCH_MODULATION_ON_THEN_TOGGLE: 0xd2,
  PITCH_MODULATION_TOGGLE_AFTER: 0xd3,
  PORTAMENTO_OFF: 0xdb,
  PORTAMENTO_ON: 0xda,
  RESET_VOICE_MODES: 0xcb,
  REST_WITH_DURATION: 0xfd,
  REVERB_OFF: 0xc3,
  REVERB_ON: 0xc2,
  SET_EXPRESSION: 0xa8,
  SET_FINE_TUNING: 0xd8,
  SET_FIXED_NOTE_LENGTH: 0xdc,
  SET_INSTRUMENT: 0xa1,
  SET_LEGATO_ON: 0xcc,
  SET_OCTAVE: 0xa5,
  SET_PAN: 0xaa,
  SET_TRANSPOSE: 0xc0,
  SET_VOLUME: 0xa3,
  SHIFT_FINE_TUNING: 0xd9,
  SHIFT_TRANSPOSE: 0xc1,
  SLIDE_EXPRESSION: 0xa9,
  SLIDE_PAN: 0xab,
  SLIDE_PAN_OSCILLATION_DEPTH: 0xdf,
  SLIDE_PITCH: 0xa4,
  SLIDE_TREMOLO_DEPTH: 0xde,
  SLIDE_VIBRATO_DEPTH: 0xdd,
  TIE_WITH_DURATION: 0xfc,
  TREMOLO_DEPTH: 0xb9,
  TREMOLO_OFF: 0xba,
  TREMOLO_ON: 0xb8,
  VIBRATO_DEPTH: 0xb5,
  VIBRATO_OFF: 0xb6,
  VIBRATO_ON: 0xb4,
} as const

export const EXTENDED_OPCODES = {
  DEPRIORITISE_CHANNEL: 0x1e,
  DRUM_MODE_OFF: 0x05,
  DRUM_MODE_ON: 0x04,
  // Two slots of the extended table hold the same end-of-track wrapper the plain 0xE1-0xEF range
  // does, so they end the channel rather than being unused.
  END_CHANNEL: 0x13,
  END_CHANNEL_ALIAS: 0x1f,
  FULL_LENGTH_NOTES_OFF: 0x1b,
  FULL_LENGTH_NOTES_ON: 0x1a,
  JUMP_ON_LOOP_COUNT: 0x08,
  JUMP_ON_LOOP_COUNT_AND_POP: 0x09,
  JUMP_ON_SONG_COUNTER: 0x07,
  JUMP_RELATIVE: 0x06,
  PLAY_SOUND_EFFECT: 0x0b,
  PRIORITISE_CHANNEL: 0x1d,
  SELECT_INSTRUMENT_MAP: 0x14,
  SELECT_KEY_TRANSPOSE: 0x1c,
  SET_INSTRUMENT_FROM_FIXED_ADDRESS: 0x0a,
  SET_MEASURE: 0x16,
  SET_NOTE_EXPRESSION: 0x19,
  SET_PART_VOLUME: 0x0e,
  SET_REVERB_DEPTH: 0x02,
  SET_REVERB_PAN: 0x17,
  SET_TEMPO: 0x00,
  SET_TIME_SIGNATURE: 0x15,
  SLIDE_PART_VOLUME: 0x0f,
  SLIDE_REVERB_DEPTH: 0x03,
  SLIDE_REVERB_PAN: 0x18,
  SLIDE_TEMPO: 0x01,
  SLIDE_VOLUME: 0x12,
} as const

// Total instruction size including the opcode byte, indexed by opcode - 0xA0. A zero means the
// opcode relocates the cursor or ends the channel, and is handled by the interpreter instead.
export const CONTROL_OPCODE_LENGTHS = [
  0, 2, 2, 2, 3, 2, 1, 1, 2, 3, 2, 3, 2, 2, 2, 2, 3, 2, 2, 1, 4, 2, 1, 2, 4, 2, 1, 2, 3, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1,
  1, 1, 0, 0, 0, 1, 0, 2, 2, 1, 0, 2, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]

// Size from the sub-opcode byte onward, so the whole instruction is one longer. These are the
// sizes the handlers read, which differ from the driver's own skip table for 0x12, 0x17, 0x18 and
// the four jumps. Zero ends the channel or is out of range.
export const EXTENDED_OPCODE_LENGTHS = [
  3, 4, 3, 4, 1, 1, 3, 4, 4, 4, 2, 5, 3, 1, 2, 3, 2, 1, 3, 0, 2, 3, 3, 2, 3, 4, 1, 1, 2, 1, 1, 0,
]

export const LOOP_SLOT_COUNT = 4

export const MODULATION_DEPTH_MASK = 0x7f
export const MODULATION_WIDE_RANGE_BIT = 0x80

// A rate, step count or repeat operand of zero means the full 256.
export const WRAPPED_OPERAND = 256

// A channel that runs this many opcodes without reaching a note has jumped into a loop that
// consumes no time; the original would hang there, so the port stops the channel instead.
export const MAX_OPCODES_PER_EVENT = 1024

// ─── Envelope registers ───

// ADSR1 is [15] attack mode, [14:10] attack shift, [9:8] attack step, [7:4] decay shift,
// [3:0] sustain level. ADSR2 is [15] sustain mode, [14] sustain direction, [12:8] sustain shift,
// [7:6] sustain step, [5] release mode, [4:0] release shift.
export const ADSR_ATTACK_RATE_MASK = 0x80ff
export const ADSR_DECAY_RATE_MASK = 0xff0f
export const ADSR_SUSTAIN_LEVEL_MASK = 0xfff0
export const ADSR_ATTACK_MODE_MASK = 0x7fff
export const ADSR_SUSTAIN_RATE_MASK = 0xe03f
export const ADSR_SUSTAIN_MODE_MASK = 0x3fff
export const ADSR_RELEASE_RATE_MASK = 0xffe0
export const ADSR_RELEASE_MODE_MASK = 0xffdf

export const ADSR_ATTACK_RATE_SHIFT = 8
export const ADSR_DECAY_RATE_SHIFT = 4
export const ADSR_SUSTAIN_RATE_SHIFT = 6

export const ADSR_EXPONENTIAL_ATTACK = 0x8000
export const ADSR_EXPONENTIAL_RELEASE = 0x20

// The envelope opcodes and the instrument-map records share one mode byte, where only these three
// values mean anything: increase/decrease crossed with linear/exponential.
export const ADSR_SUSTAIN_MODE_BITS: Record<number, number> = { 3: 0x4000, 5: 0x8000, 7: 0xc000 }
export const ADSR_EXPONENTIAL_MODE_OPERAND = 5
export const ADSR_EXPONENTIAL_RELEASE_OPERAND = 7

// ─── Instruments ───

export const INSTRUMENT_ENTRY_SIZE = 16

// An instrument operand indexes the runtime table every loaded bank shares. These two stay
// resident for the whole game at bases 0x00 and 0x20; the track's own bank joins them at 0x40.
export const RESIDENT_BANK_URLS = ['/audio/music/bank_00.akao', '/audio/music/bank_20.akao']
export const SAMPLE_RATE = 44100
export const UNITY_PITCH = 0x1000
export const MAX_PITCH = 0x3fff

// 4096 x 2^(n/12), one entry per semitone: the driver's own table rather than a recomputed one.
export const SEMITONE_PITCH_RATIOS = [
  0x1000, 0x10f3, 0x11f5, 0x1306, 0x1428, 0x155b, 0x16a0, 0x17f9, 0x1966, 0x1ae8, 0x1c82, 0x1e34,
]

export const SEMITONES_PER_OCTAVE = 12
export const CENTS_PER_OCTAVE = 1200

// A signed offset per pitch class. A sequence picks its key by naming a starting offset, so the
// twelve entries a part uses are a window on this run.
export const KEY_TRANSPOSE_TABLE = [
  0, 0, 0, -1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0,
  1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,
]

// ─── Mixing ───

export const MAX_CHANNEL_VOLUME = 127
export const PAN_CENTRE = 64
export const PAN_RANGE = 63

// A ramp still needs a non-zero span for the audio clock to schedule it against.
export const MINIMUM_RAMP_SECONDS = 0.001

// A voice's own attenuation, which an instrument-map record can lower. Zero is the driver's
// "unscaled" sentinel rather than silence.
export const VOICE_SCALE_UNITY = 128

// Reverb depth arrives as a fraction of this, matching the SPU's 15-bit depth registers.
export const REVERB_DEPTH_SCALE = 0x8000
export const REVERB_SECONDS = 0.35

// ─── Noise ───

// The SPU's noise generator picks a new level every `0x20000 >> shift` cycles of its 44100 Hz
// clock, stepping the counter by `4 + step`, where the 6-bit noise clock is `shift:step`.
export const NOISE_CLOCK_MASK = 0x3f
export const NOISE_STEP_MASK = 0x3
export const NOISE_STEP_BASE = 4
export const NOISE_SHIFT_DIVISOR = 4
export const NOISE_COUNTER_PERIOD = 0x20000
export const NOISE_BUFFER_SECONDS = 1

// ─── Track files ───

// Port music ids follow the PC build's 0-based music table; AKAO song ids on disc are 1-based.
const AKAO_SONG_ID_OFFSET = 1
export const AKAO_MUSIC_ID_COUNT = 98

export const getAkaoTrackUrl = (musicId: number) =>
  `/audio/music/song_${String(musicId + AKAO_SONG_ID_OFFSET).padStart(3, '0')}.akao`
