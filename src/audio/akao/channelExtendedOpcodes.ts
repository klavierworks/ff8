import type { ChannelContext } from './channelState'

import { NO_ADSR_OVERRIDES } from './adsrRegisters'
import { EXTENDED_OPCODE_LENGTHS, EXTENDED_OPCODES, LOOP_SLOT_COUNT, REVERB_DEPTH_SCALE } from './constants'
import { readByte, readCount, readSignedByte, readSlideSeconds, readWord } from './readOperands'
import { selectInstrument } from './selectInstrument'

// The counter `0xFE 0x07` tests lives in the song's own state and nothing has been found that
// writes it, so the port holds it where a fresh playthrough starts. No shipped track uses the
// opcode.
const UNTRACED_SONG_COUNTER = 0

// A displacement is measured from its own field, not from the instruction after it.
const jumpTo = (context: ChannelContext, displacementIndex: number) => {
  const offset = context.channel.cursor + displacementIndex
  context.channel.cursor = offset + ((readWord(context, displacementIndex) << 16) >> 16)
}

const skipDisplacement = (context: ChannelContext, displacementIndex: number) => {
  context.channel.cursor += displacementIndex + 2
}

const jumpOnLoopCount = (context: ChannelContext, shouldPopSlot: boolean) => {
  const { channel } = context
  const slot = channel.loopSlots[channel.loopSlotIndex]

  if (!slot || slot.iteration + 1 !== readCount(context, 1)) {
    skipDisplacement(context, 2)
    return
  }
  jumpTo(context, 2)
  if (shouldPopSlot) {
    channel.loopSlotIndex = (channel.loopSlotIndex + LOOP_SLOT_COUNT - 1) % LOOP_SLOT_COUNT
  }
}

const setReverbPan = (context: ChannelContext, offset: number, rampSeconds: number) => {
  const { channel } = context
  channel.panOffset = offset
  context.voice.setPan(channel.pan + channel.panOffset, context.time, rampSeconds)
  context.voice.setReverbEnabled(true, context.time)
}

const endChannel = (context: ChannelContext) => {
  context.channel.isFinished = true
}

type ExtendedOpcodeHandler = (context: ChannelContext) => void

// Operands are read from index 1 onward, the sub-opcode byte itself being at index 0. 0x0C, 0x0D,
// 0x10 and 0x11 are absent because FF8 leaves their handlers empty.
const EXTENDED_OPCODE_HANDLERS: Record<number, ExtendedOpcodeHandler> = {
  [EXTENDED_OPCODES.DEPRIORITISE_CHANNEL]: () => {},
  [EXTENDED_OPCODES.DRUM_MODE_OFF]: (context) => {
    context.channel.isDrumMode = false
    context.channel.volumeScale = 0
  },
  [EXTENDED_OPCODES.DRUM_MODE_ON]: (context) => {
    context.channel.isDrumMode = true
  },
  [EXTENDED_OPCODES.END_CHANNEL]: endChannel,
  [EXTENDED_OPCODES.END_CHANNEL_ALIAS]: endChannel,
  [EXTENDED_OPCODES.FULL_LENGTH_NOTES_OFF]: (context) => {
    context.channel.isFullLength = false
  },
  [EXTENDED_OPCODES.FULL_LENGTH_NOTES_ON]: (context) => {
    context.channel.isFullLength = true
  },
  [EXTENDED_OPCODES.JUMP_ON_LOOP_COUNT]: (context) => jumpOnLoopCount(context, false),
  [EXTENDED_OPCODES.JUMP_ON_LOOP_COUNT_AND_POP]: (context) => jumpOnLoopCount(context, true),
  [EXTENDED_OPCODES.JUMP_ON_SONG_COUNTER]: (context) => {
    if (UNTRACED_SONG_COUNTER < readByte(context, 1)) {
      skipDisplacement(context, 2)
      return
    }
    jumpTo(context, 2)
  },
  [EXTENDED_OPCODES.JUMP_RELATIVE]: (context) => jumpTo(context, 1),
  // Hands two pointers to the sound-effect player, a subsystem separate from the music sequencer
  // with no counterpart here.
  [EXTENDED_OPCODES.PLAY_SOUND_EFFECT]: () => {},
  // The driver commits these channels to hardware voices ahead of the rest, which decides who
  // keeps a voice when all 24 are busy. Every channel here owns its own voice for the life of the
  // track, so there is nothing to prioritise.
  [EXTENDED_OPCODES.PRIORITISE_CHANNEL]: () => {},
  [EXTENDED_OPCODES.SELECT_INSTRUMENT_MAP]: (context) => {
    const { channel } = context
    channel.instrumentRegions = context.instrumentMaps[readByte(context, 1)]
    channel.isDrumMode = false
    channel.adsrOverrides = NO_ADSR_OVERRIDES
  },
  [EXTENDED_OPCODES.SELECT_KEY_TRANSPOSE]: (context) => context.song.selectKeyTranspose(readByte(context, 1)),
  // The driver points the voice at a fixed address in sound RAM rather than the instrument's own
  // sample, which nothing in the archive depends on.
  [EXTENDED_OPCODES.SET_INSTRUMENT_FROM_FIXED_ADDRESS]: (context) => selectInstrument(context, 1),
  [EXTENDED_OPCODES.SET_MEASURE]: (context) => context.song.setMeasure(readWord(context, 1)),
  [EXTENDED_OPCODES.SET_NOTE_EXPRESSION]: (context) => {
    context.channel.noteExpression = {
      startValue: readSignedByte(context, 1),
      targetValue: readByte(context, 3),
      ticks: readCount(context, 2),
    }
  },
  [EXTENDED_OPCODES.SET_PART_VOLUME]: (context) => context.voice.setPartVolume(readByte(context, 1), context.time, 0),
  [EXTENDED_OPCODES.SET_REVERB_DEPTH]: (context) =>
    context.song.setReverbDepth(readWord(context, 1) / REVERB_DEPTH_SCALE, context.time, 0),
  [EXTENDED_OPCODES.SET_REVERB_PAN]: (context) => setReverbPan(context, readByte(context, 1), 0),
  [EXTENDED_OPCODES.SET_TEMPO]: (context) => context.song.setTempo(readWord(context, 1), 0),
  [EXTENDED_OPCODES.SET_TIME_SIGNATURE]: (context) =>
    context.song.setTimeSignature(readByte(context, 1), readByte(context, 2)),
  [EXTENDED_OPCODES.SLIDE_PART_VOLUME]: (context) =>
    context.voice.setPartVolume(readByte(context, 2), context.time, readSlideSeconds(context, 1)),
  [EXTENDED_OPCODES.SLIDE_REVERB_DEPTH]: (context) =>
    context.song.setReverbDepth(readWord(context, 2) / REVERB_DEPTH_SCALE, context.time, readSlideSeconds(context, 1)),
  [EXTENDED_OPCODES.SLIDE_REVERB_PAN]: (context) =>
    setReverbPan(context, readSignedByte(context, 2), readSlideSeconds(context, 1)),
  [EXTENDED_OPCODES.SLIDE_TEMPO]: (context) => context.song.setTempo(readWord(context, 2), readCount(context, 1)),
  [EXTENDED_OPCODES.SLIDE_VOLUME]: (context) =>
    context.voice.setVolume(readByte(context, 2), context.time, readSlideSeconds(context, 1)),
}

// The jumps relocate the cursor themselves, so they must not also be stepped over.
const RELOCATING_SUB_OPCODES = new Set<number>([
  EXTENDED_OPCODES.END_CHANNEL,
  EXTENDED_OPCODES.END_CHANNEL_ALIAS,
  EXTENDED_OPCODES.JUMP_ON_LOOP_COUNT,
  EXTENDED_OPCODES.JUMP_ON_LOOP_COUNT_AND_POP,
  EXTENDED_OPCODES.JUMP_ON_SONG_COUNTER,
  EXTENDED_OPCODES.JUMP_RELATIVE,
])

export const applyExtendedOpcode = (context: ChannelContext) => {
  const subOpcode = context.stream[context.channel.cursor]
  EXTENDED_OPCODE_HANDLERS[subOpcode]?.(context)

  if (RELOCATING_SUB_OPCODES.has(subOpcode)) {
    return
  }
  // A sub-opcode with no length is one the driver's table does not name; it consumes the 0xFE
  // byte alone and the byte after it is read as a fresh opcode, which is what the driver's own
  // lookahead does with them.
  context.channel.cursor += EXTENDED_OPCODE_LENGTHS[subOpcode] ?? 0
}
