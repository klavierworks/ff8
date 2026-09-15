import type { ChannelContext } from './channelState'
import type { AkaoDepthSlide, AkaoModulation, AkaoModulationUpdate } from './types'

import {
  NO_ADSR_OVERRIDES,
  setAttackMode,
  setAttackRate,
  setDecayRate,
  setReleaseMode,
  setReleaseRate,
  setSustainLevel,
  setSustainMode,
  setSustainRate,
} from './adsrRegisters'
import {
  CONTROL_OPCODE_LENGTHS,
  CONTROL_RANGE_START,
  MODULATION_DEPTH_MASK,
  MODULATION_WIDE_RANGE_BIT,
  NOISE_CLOCK_MASK,
  SEQUENCE_OPCODES,
} from './constants'
import { readByte, readCount, readSignedByte, readSlideSeconds } from './readOperands'
import { selectInstrument } from './selectInstrument'

export const getControlLength = (opcode: number) => CONTROL_OPCODE_LENGTHS[opcode - CONTROL_RANGE_START] ?? 0

const startModulation = (
  current: AkaoModulation | undefined,
  shape: { delayTicks: number; rateInterrupts: number; waveformIndex: number },
): AkaoModulation => ({
  delayTicks: shape.delayTicks,
  depth: current?.depth ?? 0,
  isWideRange: current?.isWideRange ?? false,
  rateInterrupts: shape.rateInterrupts,
  waveformIndex: shape.waveformIndex,
})

const withDepth = (current: AkaoModulation | undefined, operand: number): AkaoModulation => ({
  delayTicks: current?.delayTicks ?? 0,
  depth: operand & MODULATION_DEPTH_MASK,
  isWideRange: (operand & MODULATION_WIDE_RANGE_BIT) !== 0,
  rateInterrupts: current?.rateInterrupts ?? 1,
  waveformIndex: current?.waveformIndex ?? 0,
})

const readDepthSlide = (context: ChannelContext): AkaoDepthSlide => ({
  seconds: readSlideSeconds(context, 0),
  target: readByte(context, 1),
})

const toModulationUpdate = (
  context: ChannelContext,
  modulation: AkaoModulation | undefined,
  slide?: AkaoDepthSlide,
): AkaoModulationUpdate => ({ modulation, slide, tickSeconds: context.tickSeconds, time: context.time })

const setPan = (context: ChannelContext, rampSeconds: number) => {
  const { channel } = context
  context.voice.setPan(channel.pan + channel.panOffset, context.time, rampSeconds)
}

const setExpression = (context: ChannelContext, value: number, rampSeconds: number) => {
  context.channel.expression = value
  context.voice.setExpression(value, context.time, rampSeconds)
}

type ControlOpcodeHandler = (context: ChannelContext) => void

// Opcodes absent from this table either relocate the cursor or are the three FF8 leaves as empty
// handlers: 0xCD, 0xD0 and 0xD1.
const CONTROL_OPCODE_HANDLERS: Record<number, ControlOpcodeHandler> = {
  [SEQUENCE_OPCODES.ADSR_ATTACK_MODE]: (context) => {
    context.channel.adsr = setAttackMode(context.channel.adsr, readByte(context, 0))
  },
  [SEQUENCE_OPCODES.ADSR_ATTACK_RATE]: (context) => {
    context.channel.adsr = setAttackRate(context.channel.adsr, readByte(context, 0))
    context.channel.adsrOverrides = { ...context.channel.adsrOverrides, hasAttackRate: true }
  },
  [SEQUENCE_OPCODES.ADSR_DECAY_AND_SUSTAIN_LEVEL]: (context) => {
    context.channel.adsr = setSustainLevel(
      setDecayRate(context.channel.adsr, readByte(context, 0)),
      readByte(context, 1),
    )
  },
  [SEQUENCE_OPCODES.ADSR_DECAY_RATE]: (context) => {
    context.channel.adsr = setDecayRate(context.channel.adsr, readByte(context, 0))
  },
  [SEQUENCE_OPCODES.ADSR_RELEASE_MODE]: (context) => {
    context.channel.adsr = setReleaseMode(context.channel.adsr, readByte(context, 0))
  },
  [SEQUENCE_OPCODES.ADSR_RELEASE_RATE]: (context) => {
    context.channel.adsr = setReleaseRate(context.channel.adsr, readByte(context, 0))
    context.channel.adsrOverrides = { ...context.channel.adsrOverrides, hasReleaseRate: true }
  },
  [SEQUENCE_OPCODES.ADSR_RESET]: (context) => {
    const { channel } = context
    channel.adsr = context.instrumentRegisters[channel.instrumentIndex] ?? channel.adsr
    channel.adsrOverrides = NO_ADSR_OVERRIDES
  },
  [SEQUENCE_OPCODES.ADSR_SUSTAIN_LEVEL]: (context) => {
    context.channel.adsr = setSustainLevel(context.channel.adsr, readByte(context, 0))
  },
  [SEQUENCE_OPCODES.ADSR_SUSTAIN_MODE]: (context) => {
    context.channel.adsr = setSustainMode(context.channel.adsr, readByte(context, 0))
  },
  [SEQUENCE_OPCODES.ADSR_SUSTAIN_RATE]: (context) => {
    context.channel.adsr = setSustainRate(context.channel.adsr, readByte(context, 0))
    context.channel.adsrOverrides = { ...context.channel.adsrOverrides, hasSustainRate: true }
  },
  [SEQUENCE_OPCODES.COPY_PITCH_OFF]: (context) => {
    context.channel.isPitchFromPreviousChannel = false
  },
  [SEQUENCE_OPCODES.COPY_PITCH_ON]: (context) => {
    context.channel.isPitchFromPreviousChannel = true
  },
  [SEQUENCE_OPCODES.COPY_VOLUME_OFF]: (context) => {
    context.channel.isVolumeFromPreviousChannel = false
  },
  [SEQUENCE_OPCODES.COPY_VOLUME_ON]: (context) => {
    context.channel.isVolumeFromPreviousChannel = true
  },
  [SEQUENCE_OPCODES.NOISE_CLOCK]: (context) => {
    context.song.setNoiseClock(readByte(context, 0) & NOISE_CLOCK_MASK)
  },
  [SEQUENCE_OPCODES.NOISE_OFF]: (context) => {
    context.channel.isNoiseEnabled = false
    context.channel.noiseToggleTicks = 0
    context.voice.setNoise(undefined)
  },
  [SEQUENCE_OPCODES.NOISE_ON]: (context) => {
    context.channel.isNoiseEnabled = true
    context.voice.setNoise({ clock: context.noiseClock })
  },
  [SEQUENCE_OPCODES.NOISE_ON_THEN_TOGGLE]: (context) => {
    context.channel.noiseToggleTicks = readCount(context, 0) + 1
    context.channel.isNoiseEnabled = true
    context.voice.setNoise({ clock: context.noiseClock })
  },
  [SEQUENCE_OPCODES.NOISE_TOGGLE_AFTER]: (context) => {
    context.channel.noiseToggleTicks = readCount(context, 0) + 1
  },
  [SEQUENCE_OPCODES.OCTAVE_DOWN]: (context) => {
    context.channel.octave = (context.channel.octave - 1) & 0xf
  },
  [SEQUENCE_OPCODES.OCTAVE_UP]: (context) => {
    context.channel.octave = (context.channel.octave + 1) & 0xf
  },
  [SEQUENCE_OPCODES.OVERWRITE_NOTE_LENGTH]: (context) => {
    const { channel } = context
    const ticks = readByte(context, 0)
    channel.durationTicks = ticks
    channel.gateTicks = ticks
    channel.noteLengthTicks = ticks
    channel.fixedGateTicks = 0
  },
  [SEQUENCE_OPCODES.PAN_OSCILLATION_DEPTH]: (context) => {
    context.channel.panOscillation = withDepth(context.channel.panOscillation, readByte(context, 0))
    context.voice.setPanOscillation(toModulationUpdate(context, context.channel.panOscillation))
  },
  [SEQUENCE_OPCODES.PAN_OSCILLATION_OFF]: (context) => {
    context.channel.panOscillation = undefined
    context.voice.setPanOscillation(toModulationUpdate(context, undefined))
  },
  // Unlike vibrato and tremolo, pan oscillation carries no delay operand.
  [SEQUENCE_OPCODES.PAN_OSCILLATION_ON]: (context) => {
    context.channel.panOscillation = startModulation(context.channel.panOscillation, {
      delayTicks: 0,
      rateInterrupts: readCount(context, 0),
      waveformIndex: readByte(context, 1),
    })
    context.voice.setPanOscillation(toModulationUpdate(context, context.channel.panOscillation))
  },
  [SEQUENCE_OPCODES.PITCH_MODULATION_OFF]: (context) => {
    context.channel.isPitchModulationEnabled = false
    context.channel.pitchModulationToggleTicks = 0
    context.voice.setPitchModulationEnabled(false, context.time)
  },
  [SEQUENCE_OPCODES.PITCH_MODULATION_ON]: (context) => {
    context.channel.isPitchModulationEnabled = true
    context.voice.setPitchModulationEnabled(true, context.time)
  },
  [SEQUENCE_OPCODES.PITCH_MODULATION_ON_THEN_TOGGLE]: (context) => {
    context.channel.pitchModulationToggleTicks = readCount(context, 0) + 1
    context.channel.isPitchModulationEnabled = true
    context.voice.setPitchModulationEnabled(true, context.time)
  },
  [SEQUENCE_OPCODES.PITCH_MODULATION_TOGGLE_AFTER]: (context) => {
    context.channel.pitchModulationToggleTicks = readCount(context, 0) + 1
  },
  [SEQUENCE_OPCODES.PORTAMENTO_OFF]: (context) => {
    context.channel.portamentoTicks = 0
  },
  [SEQUENCE_OPCODES.PORTAMENTO_ON]: (context) => {
    const { channel } = context
    channel.portamentoTicks = readCount(context, 0)
    channel.previousTranspose = 0
    channel.previousSemitone = 0
    channel.isLegato = true
    channel.isNoteHeld = false
  },
  [SEQUENCE_OPCODES.RESET_VOICE_MODES]: (context) => {
    const { channel, voice } = context
    channel.isNoiseEnabled = false
    channel.isPitchModulationEnabled = false
    channel.isPitchFromPreviousChannel = false
    channel.isVolumeFromPreviousChannel = false
    channel.noiseToggleTicks = 0
    channel.pitchModulationToggleTicks = 0
    channel.isLegato = false
    voice.setNoise(undefined)
    voice.setPitchModulationEnabled(false, context.time)
    voice.setReverbEnabled(false, context.time)
  },
  [SEQUENCE_OPCODES.REVERB_OFF]: (context) => context.voice.setReverbEnabled(false, context.time),
  [SEQUENCE_OPCODES.REVERB_ON]: (context) => context.voice.setReverbEnabled(true, context.time),
  [SEQUENCE_OPCODES.SET_EXPRESSION]: (context) => {
    context.channel.noteExpression = undefined
    setExpression(context, readByte(context, 0), 0)
  },
  [SEQUENCE_OPCODES.SET_FINE_TUNING]: (context) => {
    context.channel.detune = readSignedByte(context, 0)
  },
  // The gate is measured from the last note length, so a run of notes is clipped by one amount.
  [SEQUENCE_OPCODES.SET_FIXED_NOTE_LENGTH]: (context) => {
    const { channel } = context
    const offset = readSignedByte(context, 0)
    channel.fixedGateTicks = offset === 0 ? 0 : Math.max(1, Math.min(255, channel.noteLengthTicks + offset))
  },
  [SEQUENCE_OPCODES.SET_INSTRUMENT]: (context) => selectInstrument(context, 0),
  [SEQUENCE_OPCODES.SET_LEGATO_ON]: (context) => {
    context.channel.isLegato = true
    context.channel.isNoteHeld = false
  },
  [SEQUENCE_OPCODES.SET_OCTAVE]: (context) => {
    context.channel.octave = readByte(context, 0)
  },
  [SEQUENCE_OPCODES.SET_PAN]: (context) => {
    context.channel.pan = readByte(context, 0)
    setPan(context, 0)
  },
  [SEQUENCE_OPCODES.SET_TRANSPOSE]: (context) => {
    context.channel.transpose = readSignedByte(context, 0)
  },
  [SEQUENCE_OPCODES.SET_VOLUME]: (context) => context.voice.setVolume(readByte(context, 0), context.time, 0),
  [SEQUENCE_OPCODES.SHIFT_FINE_TUNING]: (context) => {
    context.channel.detune += readSignedByte(context, 0)
  },
  [SEQUENCE_OPCODES.SHIFT_TRANSPOSE]: (context) => {
    context.channel.transpose += readSignedByte(context, 0)
  },
  [SEQUENCE_OPCODES.SLIDE_EXPRESSION]: (context) => {
    context.channel.noteExpression = undefined
    setExpression(context, readByte(context, 1), readSlideSeconds(context, 0))
  },
  [SEQUENCE_OPCODES.SLIDE_PAN]: (context) => {
    context.channel.pan = readByte(context, 1)
    setPan(context, readSlideSeconds(context, 0))
  },
  [SEQUENCE_OPCODES.SLIDE_PAN_OSCILLATION_DEPTH]: (context) => {
    const slide = readDepthSlide(context)
    context.channel.panOscillation = withDepth(context.channel.panOscillation, slide.target)
    context.voice.setPanOscillation(toModulationUpdate(context, context.channel.panOscillation, slide))
  },
  [SEQUENCE_OPCODES.SLIDE_PITCH]: (context) => {
    context.channel.pitchSlideTicks = readCount(context, 0)
    context.channel.pitchSlideSemitones = readSignedByte(context, 1)
  },
  [SEQUENCE_OPCODES.SLIDE_TREMOLO_DEPTH]: (context) => {
    const slide = readDepthSlide(context)
    context.channel.tremolo = withDepth(context.channel.tremolo, slide.target)
    context.voice.setTremolo(toModulationUpdate(context, context.channel.tremolo, slide))
  },
  [SEQUENCE_OPCODES.SLIDE_VIBRATO_DEPTH]: (context) => {
    const slide = readDepthSlide(context)
    context.channel.vibrato = withDepth(context.channel.vibrato, slide.target)
    context.voice.setVibrato(toModulationUpdate(context, context.channel.vibrato, slide))
  },
  [SEQUENCE_OPCODES.TREMOLO_DEPTH]: (context) => {
    context.channel.tremolo = withDepth(context.channel.tremolo, readByte(context, 0))
    context.voice.setTremolo(toModulationUpdate(context, context.channel.tremolo))
  },
  [SEQUENCE_OPCODES.TREMOLO_OFF]: (context) => {
    context.channel.tremolo = undefined
    context.voice.setTremolo(toModulationUpdate(context, undefined))
  },
  [SEQUENCE_OPCODES.TREMOLO_ON]: (context) => {
    context.channel.tremolo = startModulation(context.channel.tremolo, {
      delayTicks: readByte(context, 0),
      rateInterrupts: readCount(context, 1),
      waveformIndex: readByte(context, 2),
    })
    context.voice.setTremolo(toModulationUpdate(context, context.channel.tremolo))
  },
  [SEQUENCE_OPCODES.VIBRATO_DEPTH]: (context) => {
    context.channel.vibrato = withDepth(context.channel.vibrato, readByte(context, 0))
    context.voice.setVibrato(toModulationUpdate(context, context.channel.vibrato))
  },
  [SEQUENCE_OPCODES.VIBRATO_OFF]: (context) => {
    context.channel.vibrato = undefined
    context.voice.setVibrato(toModulationUpdate(context, undefined))
  },
  [SEQUENCE_OPCODES.VIBRATO_ON]: (context) => {
    context.channel.vibrato = startModulation(context.channel.vibrato, {
      delayTicks: readByte(context, 0),
      rateInterrupts: readCount(context, 1),
      waveformIndex: readByte(context, 2),
    })
    context.voice.setVibrato(toModulationUpdate(context, context.channel.vibrato))
  },
}

export const applyControlOpcode = (context: ChannelContext, opcode: number) => {
  CONTROL_OPCODE_HANDLERS[opcode]?.(context)
  context.channel.cursor += Math.max(0, getControlLength(opcode) - 1)
}

export const advanceVoiceModeTimers = (context: ChannelContext) => {
  const { channel, voice } = context

  if (channel.noiseToggleTicks > 0) {
    channel.noiseToggleTicks -= 1
    if (channel.noiseToggleTicks === 0) {
      channel.isNoiseEnabled = !channel.isNoiseEnabled
      voice.setNoise(channel.isNoiseEnabled ? { clock: context.noiseClock } : undefined)
    }
  }

  if (channel.pitchModulationToggleTicks > 0) {
    channel.pitchModulationToggleTicks -= 1
    if (channel.pitchModulationToggleTicks === 0) {
      channel.isPitchModulationEnabled = !channel.isPitchModulationEnabled
      voice.setPitchModulationEnabled(channel.isPitchModulationEnabled, context.time)
    }
  }
}
