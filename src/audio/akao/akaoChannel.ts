import type { AdsrRegisters } from './adsrRegisters'
import type { ChannelContext } from './channelState'
import type { AkaoInstrumentRegion } from './parseAkaoFile'

import { applyRegionRegisters } from './adsrRegisters'
import { applyExtendedOpcode } from './channelExtendedOpcodes'
import { advanceVoiceModeTimers, applyControlOpcode, getControlLength } from './channelOpcodes'
import {
  CONTROL_RANGE_START,
  DURATIONS_PER_PITCH,
  GATE_COUNTER_LIMIT,
  LOOP_SLOT_COUNT,
  MAX_OPCODES_PER_EVENT,
  NOTE_DURATION_TICKS,
  NOTE_GATE_SHORTENING_TICKS,
  REST_RANGE_START,
  SEMITONES_PER_OCTAVE,
  SEQUENCE_OPCODES,
  TIE_RANGE_START,
  WRAPPED_OPERAND,
} from './constants'
import { getInstrumentRegion } from './instrumentBank'

export { createChannelState } from './channelState'
export type { AkaoChannelState, ChannelContext } from './channelState'

const isEndOpcode = (opcode: number) =>
  opcode === SEQUENCE_OPCODES.END ||
  opcode === SEQUENCE_OPCODES.END_ALIAS ||
  (opcode >= SEQUENCE_OPCODES.END_RANGE_START && opcode <= SEQUENCE_OPCODES.END_RANGE_END)

const isNoteWithDuration = (opcode: number) =>
  opcode >= SEQUENCE_OPCODES.NOTE_WITH_DURATION_START && opcode <= SEQUENCE_OPCODES.NOTE_WITH_DURATION_END

// The driver folds the explicit-duration opcodes back into the note, tie and rest code space so
// both forms take one path.
const toEventCode = (opcode: number) => (opcode - SEQUENCE_OPCODES.NOTE_WITH_DURATION_START) * DURATIONS_PER_PITCH

// A tied note must not be keyed off early, so the next event is read ahead. Relocating opcodes
// end the search: following them is the interpreter's job, not the lookahead's.
const isNextEventTie = (stream: Uint8Array, startCursor: number) => {
  let cursor = startCursor
  for (let guard = 0; guard < MAX_OPCODES_PER_EVENT; guard += 1) {
    const opcode = stream[cursor]
    if (opcode === undefined) {
      return false
    }
    if (opcode < CONTROL_RANGE_START) {
      return opcode >= TIE_RANGE_START && opcode < REST_RANGE_START
    }
    if (opcode === SEQUENCE_OPCODES.TIE_WITH_DURATION) {
      return true
    }
    if (isNoteWithDuration(opcode) || opcode === SEQUENCE_OPCODES.REST_WITH_DURATION) {
      return false
    }
    const length = getControlLength(opcode)
    if (length === 0) {
      return false
    }
    cursor += length
  }
  return false
}

const shortenGate = (gateTicks: number) =>
  (gateTicks - NOTE_GATE_SHORTENING_TICKS + GATE_COUNTER_LIMIT) % GATE_COUNTER_LIMIT

const setEventLength = (context: ChannelContext, eventCode: number) => {
  const { channel } = context
  const isSustained = isNextEventTie(context.stream, channel.cursor) || channel.isLegato

  if (channel.fixedGateTicks !== 0) {
    channel.durationTicks = channel.fixedGateTicks
    channel.gateTicks = channel.fixedGateTicks
  }

  if (channel.durationTicks !== 0) {
    channel.gateTicks = isSustained ? channel.gateTicks : shortenGate(channel.gateTicks)
  } else {
    const duration = NOTE_DURATION_TICKS[eventCode % DURATIONS_PER_PITCH]
    channel.durationTicks = duration
    channel.gateTicks = isSustained ? duration : shortenGate(duration)
  }

  if (channel.isFullLength) {
    channel.gateTicks = channel.durationTicks
  }
  channel.noteLengthTicks = channel.durationTicks
}

// Instrument maps are keyed by the note before transpose, not by the pitch it sounds at.
const getNoteKey = (context: ChannelContext, pitchIndex: number) => {
  const { channel } = context
  const key = pitchIndex + channel.octave * SEMITONES_PER_OCTAVE
  if (channel.isNoteHeld) {
    return key
  }
  return key + context.song.getKeyTranspose(key % SEMITONES_PER_OCTAVE)
}

const getRegionRegisters = (
  context: ChannelContext,
  region: AkaoInstrumentRegion,
  instrumentIndex: number,
): AdsrRegisters => {
  const { channel } = context
  const instrument = context.instrumentRegisters[instrumentIndex]
  if (!instrument) {
    return channel.adsr
  }
  return applyRegionRegisters({ current: channel.adsr, instrument, overrides: channel.adsrOverrides, region })
}

const selectNoteInstrument = (context: ChannelContext, key: number) => {
  const { channel } = context
  if (!channel.instrumentRegions) {
    return channel.instrumentIndex
  }

  const region = getInstrumentRegion(channel.instrumentRegions, key)
  if (!region) {
    return channel.instrumentIndex
  }

  const instrumentIndex = region.instrumentOperand
  channel.adsr = getRegionRegisters(context, region, instrumentIndex)
  channel.volumeScale = region.volumeScale
  return instrumentIndex
}

// A bend is consumed whether the next event strikes a note or ties onto the one sounding.
const takePendingBend = (context: ChannelContext) => {
  const { channel } = context
  if (channel.pitchSlideSemitones === 0) {
    return { slideSeconds: 0, slideSemitone: channel.semitone + channel.transpose }
  }

  channel.semitone += channel.pitchSlideSemitones
  channel.pitchSlideSemitones = 0
  return {
    slideSeconds: channel.pitchSlideTicks * context.tickSeconds,
    slideSemitone: channel.semitone + channel.transpose,
  }
}

const finishPitchedEvent = (context: ChannelContext) => {
  const { channel } = context
  channel.isNoteHeld = channel.isLegato
  channel.previousSemitone = channel.semitone
  channel.previousTranspose = channel.transpose
}

const restartNoteExpression = (context: ChannelContext) => {
  const { channel } = context
  if (!channel.noteExpression) {
    return
  }
  const { startValue, targetValue, ticks } = channel.noteExpression
  channel.expression = targetValue
  context.voice.setExpression(startValue, context.time, 0)
  context.voice.setExpression(targetValue, context.time, ticks * context.tickSeconds)
}

// The drum table names the pitch outright, so the key is played neither transposed nor bent.
const strikeDrumNote = (context: ChannelContext, key: number) => {
  const { channel, voice } = context
  const record = context.drumRecords[key]
  channel.semitone = key

  if (!record) {
    finishPitchedEvent(context)
    return
  }

  const instrumentIndex = record.instrumentOperand
  const instrument = context.instrumentRegisters[instrumentIndex]
  channel.instrumentIndex = instrumentIndex
  if (instrument) {
    channel.adsr = applyRegionRegisters({
      current: channel.adsr,
      instrument,
      overrides: channel.adsrOverrides,
      region: record,
    })
  }
  channel.volumeScale = record.volumeScale

  voice.setPan(record.pan, context.time, 0)
  voice.setReverbEnabled(record.hasReverb, context.time)
  voice.keyOn({
    adsr1: channel.adsr.adsr1,
    adsr2: channel.adsr.adsr2,
    detune: channel.detune,
    instrumentIndex,
    isHeld: false,
    semitone: record.semitone,
    slideSeconds: 0,
    slideSemitone: record.semitone,
    time: context.time,
    volumeScale: record.volumeScale,
  })
  finishPitchedEvent(context)
}

const strikeNote = (context: ChannelContext, pitchIndex: number) => {
  const { channel, voice } = context
  const key = channel.isPitchFromPreviousChannel ? context.previousChannelSemitone : getNoteKey(context, pitchIndex)

  if (channel.isDrumMode) {
    strikeDrumNote(context, key)
    return
  }

  const instrumentIndex = channel.isNoteHeld ? channel.instrumentIndex : selectNoteInstrument(context, key)

  // Portamento starts the note where the last one ended and leaves the climb to the bend, so the
  // two notes join. The first note of a channel has nothing to slide from.
  const isPortamento = channel.portamentoTicks !== 0 && channel.previousSemitone !== 0
  const startSemitone = isPortamento ? channel.previousSemitone + channel.previousTranspose : key + channel.transpose

  if (isPortamento) {
    channel.pitchSlideTicks = channel.portamentoTicks
    channel.pitchSlideSemitones = channel.transpose + key - channel.previousSemitone - channel.previousTranspose
    channel.semitone = channel.previousSemitone - channel.transpose + channel.previousTranspose
  } else {
    channel.semitone = key
  }

  if (!channel.isNoteHeld) {
    channel.instrumentIndex = instrumentIndex
    restartNoteExpression(context)
    if (channel.isVolumeFromPreviousChannel) {
      voice.setExpression(context.previousChannelExpression, context.time, 0)
    }
  }

  const bend = takePendingBend(context)
  voice.keyOn({
    adsr1: channel.adsr.adsr1,
    adsr2: channel.adsr.adsr2,
    detune: channel.detune,
    instrumentIndex,
    isHeld: channel.isNoteHeld,
    semitone: startSemitone,
    slideSeconds: bend.slideSeconds,
    slideSemitone: bend.slideSemitone,
    time: context.time,
    volumeScale: channel.volumeScale,
  })
  finishPitchedEvent(context)
}

// A bend left standing still takes effect across a tie.
const extendNote = (context: ChannelContext) => {
  const bend = takePendingBend(context)
  if (bend.slideSeconds > 0) {
    context.voice.slidePitch(bend.slideSemitone, context.time, bend.slideSeconds)
  }
  finishPitchedEvent(context)
}

const startRest = (context: ChannelContext) => {
  const { channel } = context
  channel.isNoteHeld = false
  channel.portamentoTicks = 0
  context.voice.keyOff(context.time)
}

const playEvent = (context: ChannelContext, eventCode: number) => {
  setEventLength(context, eventCode)

  if (eventCode >= REST_RANGE_START) {
    startRest(context)
    return
  }
  if (eventCode >= TIE_RANGE_START) {
    extendNote(context)
    return
  }
  strikeNote(context, Math.floor(eventCode / DURATIONS_PER_PITCH))
}

const startLoop = (context: ChannelContext) => {
  const { channel } = context
  channel.loopSlotIndex = (channel.loopSlotIndex + 1) % LOOP_SLOT_COUNT
  channel.loopSlots[channel.loopSlotIndex] = { cursor: channel.cursor, iteration: 0 }
}

const endLoop = (context: ChannelContext) => {
  const { channel } = context
  const slot = channel.loopSlots[channel.loopSlotIndex]
  const repeats = context.stream[channel.cursor] || WRAPPED_OPERAND
  channel.cursor += 1

  if (!slot) {
    channel.isFinished = true
    return
  }

  slot.iteration += 1
  if (slot.iteration < repeats) {
    channel.cursor = slot.cursor
    return
  }
  channel.loopSlotIndex = (channel.loopSlotIndex + LOOP_SLOT_COUNT - 1) % LOOP_SLOT_COUNT
}

const jumpBack = (context: ChannelContext) => {
  const { channel } = context
  const slot = channel.loopSlots[channel.loopSlotIndex]
  if (!slot) {
    channel.isFinished = true
    return
  }
  channel.cursor = slot.cursor
}

// Runs until the channel produces a timed event or stops. Everything else takes no time.
const runChannelEvents = (context: ChannelContext) => {
  const { channel, stream } = context

  for (let guard = 0; guard < MAX_OPCODES_PER_EVENT; guard += 1) {
    const opcode = stream[channel.cursor]
    if (opcode === undefined) {
      channel.isFinished = true
      return
    }
    channel.cursor += 1

    if (opcode < CONTROL_RANGE_START) {
      playEvent(context, opcode)
      return
    }
    if (isEndOpcode(opcode)) {
      channel.isFinished = true
      return
    }
    if (opcode >= SEQUENCE_OPCODES.NOTE_WITH_DURATION_START && opcode <= SEQUENCE_OPCODES.REST_WITH_DURATION) {
      channel.durationTicks = stream[channel.cursor]
      channel.cursor += 1
      playEvent(context, toEventCode(opcode))
      return
    }
    if (opcode === SEQUENCE_OPCODES.LOOP_START) {
      startLoop(context)
      continue
    }
    if (opcode === SEQUENCE_OPCODES.LOOP_END) {
      endLoop(context)
      continue
    }
    if (opcode === SEQUENCE_OPCODES.JUMP_BACK) {
      jumpBack(context)
      continue
    }
    if (opcode === SEQUENCE_OPCODES.EXTENDED) {
      applyExtendedOpcode(context)
      continue
    }
    applyControlOpcode(context, opcode)
  }

  channel.isFinished = true
}

export const advanceChannel = (context: ChannelContext) => {
  const { channel } = context
  if (channel.isFinished) {
    return
  }

  if (channel.durationTicks > 0) {
    channel.durationTicks -= 1
    channel.gateTicks = (channel.gateTicks - 1 + GATE_COUNTER_LIMIT) % GATE_COUNTER_LIMIT
    if (channel.durationTicks !== 0 && channel.gateTicks === 0) {
      context.voice.keyOff(context.time)
    }
  }

  if (channel.durationTicks === 0) {
    runChannelEvents(context)
  }
  advanceVoiceModeTimers(context)
}
