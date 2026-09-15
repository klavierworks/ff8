import type { AdsrOverrides, AdsrRegisters } from './adsrRegisters'
import type { AkaoDrumRecord, AkaoInstrumentRegion } from './parseAkaoFile'
import type { AkaoModulation, AkaoSongControls, AkaoVoice } from './types'

import { NO_ADSR_OVERRIDES } from './adsrRegisters'
import { LOOP_SLOT_COUNT, MAX_CHANNEL_VOLUME, PAN_CENTRE } from './constants'

export type AkaoChannelState = {
  adsr: AdsrRegisters
  adsrOverrides: AdsrOverrides
  cursor: number
  detune: number
  durationTicks: number
  expression: number
  fixedGateTicks: number
  // A 16-bit counter that keys off on an exact zero and keeps running past it, so a note whose
  // gate was never reloaded simply sounds on.
  gateTicks: number
  instrumentIndex: number
  instrumentRegions: AkaoInstrumentRegion[] | undefined
  isDrumMode: boolean
  isFinished: boolean
  isFullLength: boolean
  // isLegato is the channel's setting; isNoteHeld is whether the note now sounding was carried
  // over from the last one.
  isLegato: boolean
  isNoiseEnabled: boolean
  isNoteHeld: boolean
  isPitchFromPreviousChannel: boolean
  isPitchModulationEnabled: boolean
  isVolumeFromPreviousChannel: boolean
  loopSlotIndex: number
  loopSlots: (LoopSlot | undefined)[]
  noiseToggleTicks: number
  noteExpression: NoteExpression | undefined
  noteLengthTicks: number
  octave: number
  pan: number
  panOffset: number
  panOscillation: AkaoModulation | undefined
  pitchModulationToggleTicks: number
  pitchSlideSemitones: number
  pitchSlideTicks: number
  portamentoTicks: number
  previousSemitone: number
  previousTranspose: number
  semitone: number
  transpose: number
  tremolo: AkaoModulation | undefined
  vibrato: AkaoModulation | undefined
  volumeScale: number
}

export type ChannelContext = {
  channel: AkaoChannelState
  drumRecords: (AkaoDrumRecord | undefined)[]
  instrumentMaps: (AkaoInstrumentRegion[] | undefined)[]
  instrumentRegisters: (AdsrRegisters | undefined)[]
  noiseClock: number
  previousChannelExpression: number
  previousChannelSemitone: number
  song: AkaoSongControls
  stream: Uint8Array
  tickSeconds: number
  time: number
  voice: AkaoVoice
}

type LoopSlot = {
  cursor: number
  iteration: number
}

type NoteExpression = {
  startValue: number
  targetValue: number
  ticks: number
}

// The interpreter mutates execution state in place, the way the original's channel struct does;
// everything else in the engine stays derived.
export const createChannelState = (startOffset: number): AkaoChannelState => ({
  adsr: { adsr1: 0, adsr2: 0 },
  adsrOverrides: NO_ADSR_OVERRIDES,
  cursor: startOffset,
  detune: 0,
  durationTicks: 0,
  expression: MAX_CHANNEL_VOLUME,
  fixedGateTicks: 0,
  gateTicks: 0,
  instrumentIndex: 0,
  instrumentRegions: undefined,
  isDrumMode: false,
  isFinished: false,
  isFullLength: false,
  isLegato: false,
  isNoiseEnabled: false,
  isNoteHeld: false,
  isPitchFromPreviousChannel: false,
  isPitchModulationEnabled: false,
  isVolumeFromPreviousChannel: false,
  loopSlotIndex: 0,
  loopSlots: Array.from({ length: LOOP_SLOT_COUNT }),
  noiseToggleTicks: 0,
  noteExpression: undefined,
  noteLengthTicks: 0,
  octave: 0,
  pan: PAN_CENTRE,
  panOffset: 0,
  panOscillation: undefined,
  pitchModulationToggleTicks: 0,
  pitchSlideSemitones: 0,
  pitchSlideTicks: 0,
  portamentoTicks: 0,
  previousSemitone: 0,
  previousTranspose: 0,
  semitone: 0,
  transpose: 0,
  tremolo: undefined,
  vibrato: undefined,
  volumeScale: 0,
})
