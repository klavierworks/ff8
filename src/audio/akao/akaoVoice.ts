import type { AkaoOscillator } from './akaoOscillator'
import type { AutomatedParameter, AutomationPoint } from './automatedParameter'
import type { AdsrEnvelope } from './decodeAdsr'
import type { AkaoInstrumentSound } from './decodeInstruments'
import type { AkaoModulation, AkaoModulationUpdate, AkaoNoise, AkaoNote, AkaoVoice } from './types'

import { createAkaoOscillator, isSameOscillatorShape } from './akaoOscillator'
import { createAutomatedParameter } from './automatedParameter'
import {
  CENTS_PER_OCTAVE,
  MAX_CHANNEL_VOLUME,
  MINIMUM_RAMP_SECONDS,
  PAN_CENTRE,
  PAN_RANGE,
  VOICE_SCALE_UNITY,
} from './constants'
import { decodeAdsr } from './decodeAdsr'
import { getPlaybackRate } from './getPlaybackRate'
import { createNoiseBuffer, getNoisePlaybackRate } from './noiseSound'

// Vibrato's depth is a fraction of the sounding pitch: a full byte at the wide setting nearly
// doubles it, the narrow setting covers about a semitone.
const VIBRATO_DEPTH_SCALE = 128
const VIBRATO_NARROW_RANGE = 15 / 256

const TREMOLO_DEPTH_SCALE = 256
const PAN_OSCILLATION_DEPTH_SCALE = 256

// The SPU multiplies the previous voice's output sample by sample; a detune send is the nearest
// Web Audio has to that.
const PITCH_MODULATION_CENTS = 1200

type AkaoVoiceOptions = {
  audioContext: BaseAudioContext
  dryBus: AudioNode
  instruments: (AkaoInstrumentSound | undefined)[]
  reverbBus: AudioNode
}

type NoteSound = {
  buffer: AudioBuffer
  getPlaybackRateFor: (semitone: number) => number
  isLooping: boolean
  loopStartSeconds: number
}

type SoundingNote = {
  envelopeGain: AutomatedParameter
  getPlaybackRateFor: (semitone: number) => number
  playbackRate: AutomatedParameter
  releaseSeconds: number
  source: AudioBufferSourceNode
}

const getEnvelopePoints = (envelope: AdsrEnvelope, time: number): AutomationPoint[] => {
  const peakTime = time + Math.max(envelope.attackSeconds, MINIMUM_RAMP_SECONDS)
  const sustainTime = peakTime + envelope.decaySeconds

  return [
    { time: peakTime, value: 1 },
    ...(envelope.decaySeconds > 0 ? [{ time: sustainTime, value: envelope.sustainLevel }] : []),
    ...(envelope.sustainSeconds > 0
      ? [{ time: sustainTime + envelope.sustainSeconds, value: envelope.sustainTarget }]
      : []),
  ]
}

// Both registers at zero is the driver's "untouched" state, not a real envelope.
const getNoteEnvelope = (note: AkaoNote, instrument: AkaoInstrumentSound | undefined) => {
  if (note.adsr1 === 0 && note.adsr2 === 0) {
    return instrument?.envelope ?? decodeAdsr(note.adsr1, note.adsr2)
  }
  return decodeAdsr(note.adsr1, note.adsr2)
}

const getVibratoCents = (modulation: AkaoModulation) => {
  const swing = (modulation.depth / VIBRATO_DEPTH_SCALE) * (modulation.isWideRange ? 1 : VIBRATO_NARROW_RANGE)
  return CENTS_PER_OCTAVE * Math.log2(1 + swing)
}

const getTremoloSwing = (modulation: AkaoModulation) => modulation.depth / TREMOLO_DEPTH_SCALE

const getPanOscillationSwing = (modulation: AkaoModulation) => modulation.depth / PAN_OSCILLATION_DEPTH_SCALE

const getVoiceScaleGain = (volumeScale: number) =>
  volumeScale === 0 ? 1 : Math.min(1, volumeScale / VOICE_SCALE_UNITY)

const getPanPosition = (value: number) => Math.max(-1, Math.min(1, (value - PAN_CENTRE) / PAN_RANGE))

export const createAkaoVoice = ({ audioContext, dryBus, instruments, reverbBus }: AkaoVoiceOptions) => {
  const expressionGain = audioContext.createGain()
  const volumeGain = audioContext.createGain()
  const partVolumeGain = audioContext.createGain()
  const voiceScaleGain = audioContext.createGain()
  const panner = audioContext.createStereoPanner()
  const reverbSend = audioContext.createGain()
  const pitchModulationSend = audioContext.createGain()

  expressionGain.connect(volumeGain)
  volumeGain.connect(partVolumeGain)
  partVolumeGain.connect(voiceScaleGain)
  voiceScaleGain.connect(panner)
  panner.connect(dryBus)
  panner.connect(reverbSend)
  reverbSend.connect(reverbBus)
  reverbSend.gain.value = 0
  pitchModulationSend.gain.value = 0

  const expression = createAutomatedParameter(expressionGain.gain)
  const volume = createAutomatedParameter(volumeGain.gain)
  const partVolume = createAutomatedParameter(partVolumeGain.gain)
  const voiceScale = createAutomatedParameter(voiceScaleGain.gain)
  const pan = createAutomatedParameter(panner.pan)
  const reverbLevel = createAutomatedParameter(reverbSend.gain)
  const pitchModulationLevel = createAutomatedParameter(pitchModulationSend.gain)

  // Several notes can be pending at once; only one of them is the channel's current note.
  const scheduledSources = new Set<AudioBufferSourceNode>()
  let soundingNote: SoundingNote | undefined
  let vibrato: AkaoOscillator | undefined
  let tremolo: AkaoOscillator | undefined
  let panOscillation: AkaoOscillator | undefined
  let noise: AkaoNoise | undefined
  let noiseBuffer: AudioBuffer | undefined

  const keyOff = (time: number) => {
    if (!soundingNote) {
      return
    }
    const { envelopeGain, releaseSeconds, source } = soundingNote
    envelopeGain.rampTo(0, time, releaseSeconds)
    source.stop(time + releaseSeconds)
    soundingNote = undefined
  }

  const slidePitch = (semitone: number, time: number, rampSeconds: number) => {
    if (!soundingNote) {
      return
    }
    soundingNote.playbackRate.rampTo(soundingNote.getPlaybackRateFor(semitone), time, rampSeconds)
  }

  const getNoiseBuffer = () => {
    noiseBuffer = noiseBuffer ?? createNoiseBuffer(audioContext)
    return noiseBuffer
  }

  const resolveSound = (instrument: AkaoInstrumentSound | undefined, detune: number): NoteSound | undefined => {
    if (noise) {
      const rate = getNoisePlaybackRate(noise.clock)
      return { buffer: getNoiseBuffer(), getPlaybackRateFor: () => rate, isLooping: true, loopStartSeconds: 0 }
    }
    if (!instrument) {
      return undefined
    }
    return {
      buffer: instrument.buffer,
      getPlaybackRateFor: (semitone: number) => getPlaybackRate(instrument, semitone, detune),
      isLooping: instrument.isLooping,
      loopStartSeconds: instrument.loopStartSeconds,
    }
  }

  const createNoteSource = (sound: NoteSound, note: AkaoNote) => {
    const source = audioContext.createBufferSource()
    source.buffer = sound.buffer
    source.playbackRate.value = sound.getPlaybackRateFor(note.semitone)
    if (sound.isLooping) {
      source.loop = true
      source.loopStart = sound.loopStartSeconds
      source.loopEnd = sound.buffer.duration
    }
    vibrato?.output.connect(source.detune)
    pitchModulationSend.connect(source.detune)
    return source
  }

  const startNoteEnvelope = (source: AudioBufferSourceNode, envelope: AdsrEnvelope, time: number) => {
    const gain = audioContext.createGain()
    const envelopeGain = createAutomatedParameter(gain.gain)
    envelopeGain.scheduleCurve(0, time, getEnvelopePoints(envelope, time))
    source.connect(gain)
    gain.connect(expressionGain)
    source.onended = () => {
      scheduledSources.delete(source)
      gain.disconnect()
    }
    return envelopeGain
  }

  const holdNote = (sound: NoteSound, note: AkaoNote) => {
    if (!soundingNote) {
      return
    }
    soundingNote.playbackRate.setValueAt(sound.getPlaybackRateFor(note.semitone), note.time)
    slidePitch(note.slideSemitone, note.time, note.slideSeconds)
  }

  const keyOn = (note: AkaoNote) => {
    const instrument = instruments[note.instrumentIndex]
    const sound = resolveSound(instrument, note.detune)
    if (!sound) {
      keyOff(note.time)
      return
    }
    if (note.isHeld && soundingNote) {
      holdNote(sound, note)
      return
    }
    keyOff(note.time)

    const source = createNoteSource(sound, note)
    const envelope = getNoteEnvelope(note, instrument)
    const envelopeGain = startNoteEnvelope(source, envelope, note.time)
    source.start(note.time)
    scheduledSources.add(source)

    soundingNote = {
      envelopeGain,
      getPlaybackRateFor: sound.getPlaybackRateFor,
      playbackRate: createAutomatedParameter(source.playbackRate),
      releaseSeconds: Math.max(envelope.releaseSeconds, MINIMUM_RAMP_SECONDS),
      source,
    }
    voiceScale.rampTo(getVoiceScaleGain(note.volumeScale), note.time, 0)
    slidePitch(note.slideSemitone, note.time, note.slideSeconds)
  }

  // A depth change alone leaves the oscillator running, so the swing widens mid-note.
  const setOscillator = (
    current: AkaoOscillator | undefined,
    update: AkaoModulationUpdate,
    target: AudioParam | undefined,
    getSwing: (modulation: AkaoModulation) => number,
  ) => {
    const { modulation, slide, tickSeconds, time } = update
    if (!modulation || modulation.depth === 0) {
      current?.dispose()
      return undefined
    }

    if (current && isSameOscillatorShape(current.modulation, modulation)) {
      current.depth.rampTo(getSwing(modulation), time, slide?.seconds ?? 0)
      return { ...current, modulation }
    }

    current?.dispose()
    const oscillator = createAkaoOscillator(audioContext, modulation, time, modulation.delayTicks * tickSeconds)
    oscillator.depth.setValueAt(getSwing(modulation), time + oscillator.delaySeconds)
    if (target) {
      oscillator.output.connect(target)
    }
    return oscillator
  }

  const stop = () => {
    scheduledSources.forEach((source) => source.stop())
    scheduledSources.clear()
    soundingNote = undefined
  }

  const disconnect = () => {
    stop()
    vibrato?.dispose()
    tremolo?.dispose()
    panOscillation?.dispose()
    expressionGain.disconnect()
    volumeGain.disconnect()
    partVolumeGain.disconnect()
    voiceScaleGain.disconnect()
    panner.disconnect()
    reverbSend.disconnect()
    pitchModulationSend.disconnect()
  }

  const voice: AkaoVoice = {
    keyOff,
    keyOn,
    setExpression: (value, time, rampSeconds) => expression.rampTo(value / MAX_CHANNEL_VOLUME, time, rampSeconds),
    setNoise: (value) => {
      noise = value
    },
    setPan: (value, time, rampSeconds) => pan.rampTo(getPanPosition(value), time, rampSeconds),
    setPanOscillation: (update) => {
      panOscillation = setOscillator(panOscillation, update, panner.pan, getPanOscillationSwing)
    },
    setPartVolume: (value, time, rampSeconds) => partVolume.rampTo(value / MAX_CHANNEL_VOLUME, time, rampSeconds),
    setPitchModulationEnabled: (isEnabled, time) =>
      pitchModulationLevel.rampTo(isEnabled ? PITCH_MODULATION_CENTS : 0, time, 0),
    setReverbEnabled: (isEnabled, time) => reverbLevel.rampTo(isEnabled ? 1 : 0, time, 0),
    setTremolo: (update) => {
      tremolo = setOscillator(tremolo, update, volumeGain.gain, getTremoloSwing)
    },
    // A vibrato oscillator is picked up by each note's own detune, in cents, as the note starts.
    setVibrato: (update) => {
      vibrato = setOscillator(vibrato, update, undefined, getVibratoCents)
      if (vibrato && soundingNote) {
        vibrato.output.connect(soundingNote.source.detune)
      }
    },
    setVolume: (value, time, rampSeconds) => volume.rampTo(value / MAX_CHANNEL_VOLUME, time, rampSeconds),
    slidePitch,
  }

  return { disconnect, modulationOutput: panner, pitchModulationInput: pitchModulationSend, stop, voice }
}
