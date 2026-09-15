import type { AkaoChannelState } from './akaoChannel'
import type { AkaoTrackData } from './loadAkaoTrack'
import type { AkaoSongPosition } from './songPosition'
import type { AkaoSongControls } from './types'

import { advanceChannel, createChannelState } from './akaoChannel'
import { createAkaoMixer } from './akaoMixer'
import {
  DEFAULT_TEMPO,
  INTERRUPT_HZ,
  INTERRUPT_SECONDS,
  KEY_TRANSPOSE_TABLE,
  MAX_CHANNEL_VOLUME,
  MINIMUM_RAMP_SECONDS,
  TEMPO_ACCUMULATOR_LIMIT,
} from './constants'
import { advanceSongPosition, createSongPosition } from './songPosition'

// Events are written into the audio clock well ahead of time, which keeps the music steady
// through a dropped frame and through a hidden tab, where timers are throttled to once a second.
const SCHEDULE_AHEAD_SECONDS = 1.5
const PUMP_INTERVAL_MS = 250
const START_DELAY_SECONDS = 0.05

// If the pump stalls for longer than this the missed ticks are dropped rather than played back
// in a burst.
const MAX_CATCHUP_SECONDS = 1

const ALL_CHANNELS = 0xffffffff

export type AkaoTrack = ReturnType<typeof createAkaoTrack>

type AkaoTrackOptions = {
  audioContext: AudioContext
  // One bit per channel, in the order the sequence's own channel mask lists them. The concert
  // opcode uses it to play a subset of the band.
  channelMask?: number
  data: AkaoTrackData
  destination: AudioNode
  volume: number
}

type SongState = {
  channels: AkaoChannelState[]
  keyTransposeOffset: number | undefined
  noiseClock: number
  position: AkaoSongPosition
  tempo: number
  tempoAccumulator: number
  tempoSlideTicks: number
  tempoTarget: number
}

export const createAkaoTrack = ({
  audioContext,
  channelMask = ALL_CHANNELS,
  data,
  destination,
  volume,
}: AkaoTrackOptions) => {
  const { instruments, sequence } = data
  const channelStartOffsets = sequence.channelStartOffsets.filter((_, index) => (channelMask >>> index) & 1)
  const mixer = createAkaoMixer({ audioContext, destination, instruments, voiceCount: channelStartOffsets.length })
  const instrumentRegisters = instruments.map(
    (instrument) => instrument && { adsr1: instrument.adsr1, adsr2: instrument.adsr2 },
  )

  const createSongState = (): SongState => ({
    channels: channelStartOffsets.map(createChannelState),
    keyTransposeOffset: undefined,
    noiseClock: 0,
    position: createSongPosition(),
    tempo: DEFAULT_TEMPO,
    tempoAccumulator: 0,
    tempoSlideTicks: 0,
    tempoTarget: DEFAULT_TEMPO,
  })

  let state = createSongState()
  let nextInterruptTime = 0
  let pumpTimer: ReturnType<typeof setInterval> | undefined

  const song: AkaoSongControls = {
    getKeyTranspose: (pitchClass) =>
      state.keyTransposeOffset === undefined ? 0 : (KEY_TRANSPOSE_TABLE[state.keyTransposeOffset + pitchClass] ?? 0),
    selectKeyTranspose: (tableIndex) => {
      state.keyTransposeOffset = tableIndex
    },
    setMeasure: (measure) => {
      state.position = { ...state.position, beat: 0, measure, tickInBeat: 0 }
    },
    setNoiseClock: (clock) => {
      state.noiseClock = clock
    },
    setReverbDepth: mixer.setReverbDepth,
    setTempo: (value, rampTicks) => {
      state.tempoTarget = value || DEFAULT_TEMPO
      state.tempoSlideTicks = rampTicks
      if (rampTicks === 0) {
        state.tempo = state.tempoTarget
      }
    },
    setTimeSignature: (ticksPerBeat, beatsPerMeasure) => {
      state.position = { ...state.position, beat: 0, beatsPerMeasure, tickInBeat: 0, ticksPerBeat }
    },
  }

  const toGain = (value: number) => (value / MAX_CHANNEL_VOLUME) * (sequence.masterVolume / MAX_CHANNEL_VOLUME)

  const rewind = () => {
    state = createSongState()
  }

  // A tempo change asked to arrive gradually walks one step of the way on every musical tick.
  const advanceTempoSlide = () => {
    if (state.tempoSlideTicks <= 0) {
      return
    }
    state.tempo += (state.tempoTarget - state.tempo) / state.tempoSlideTicks
    state.tempoSlideTicks -= 1
  }

  const runTick = (time: number) => {
    const tickSeconds = TEMPO_ACCUMULATOR_LIMIT / (INTERRUPT_HZ * state.tempo)

    state.channels.forEach((channel, index) => {
      const previousChannel = state.channels[index - 1]
      advanceChannel({
        channel,
        drumRecords: sequence.drumRecords,
        instrumentMaps: sequence.instrumentMaps,
        instrumentRegisters,
        noiseClock: state.noiseClock,
        previousChannelExpression: previousChannel?.expression ?? MAX_CHANNEL_VOLUME,
        previousChannelSemitone: previousChannel?.semitone ?? 0,
        song,
        stream: sequence.stream,
        tickSeconds,
        time,
        voice: mixer.voices[index],
      })
    })

    advanceTempoSlide()
    state.position = advanceSongPosition(state.position)

    // A sequence whose channels have all run out has no looping tail of its own, so it starts
    // again the way the engine's looping music does.
    if (state.channels.length > 0 && state.channels.every((channel) => channel.isFinished)) {
      rewind()
    }
  }

  // The musical tick is the overflow of a 16-bit accumulator the tempo is added to on every one
  // of the driver's 240 Hz interrupts.
  const pump = () => {
    const horizon = audioContext.currentTime + SCHEDULE_AHEAD_SECONDS
    if (nextInterruptTime < audioContext.currentTime - MAX_CATCHUP_SECONDS) {
      nextInterruptTime = audioContext.currentTime
    }

    while (nextInterruptTime < horizon) {
      state.tempoAccumulator += state.tempo
      if (state.tempoAccumulator >= TEMPO_ACCUMULATOR_LIMIT) {
        state.tempoAccumulator -= TEMPO_ACCUMULATOR_LIMIT
        runTick(nextInterruptTime)
      }
      nextInterruptTime += INTERRUPT_SECONDS
    }
  }

  const startPump = () => {
    if (pumpTimer !== undefined) {
      return
    }
    nextInterruptTime = audioContext.currentTime + START_DELAY_SECONDS
    pump()
    pumpTimer = setInterval(pump, PUMP_INTERVAL_MS)
  }

  const stopPump = () => {
    if (pumpTimer === undefined) {
      return
    }
    clearInterval(pumpTimer)
    pumpTimer = undefined
    mixer.stopAll()
  }

  mixer.outputLevel.setValueAt(toGain(volume), audioContext.currentTime)

  return {
    dispose: () => {
      stopPump()
      mixer.disconnect()
    },
    getIsPlaying: () => pumpTimer !== undefined,
    getPosition: () => state.position,
    pause: stopPump,
    resume: startPump,
    setVolume: (value: number) => mixer.outputLevel.setValueAt(toGain(value), audioContext.currentTime),
    start: () => {
      rewind()
      startPump()
    },
    stop: () => {
      stopPump()
      rewind()
    },
    transitionVolume: (value: number, seconds: number) =>
      mixer.outputLevel.rampTo(toGain(value), audioContext.currentTime, Math.max(seconds, MINIMUM_RAMP_SECONDS)),
  }
}
