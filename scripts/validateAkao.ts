import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { advanceChannel, createChannelState } from '../src/audio/akao/akaoChannel'
import { INTERRUPT_HZ, MAX_PITCH, TEMPO_ACCUMULATOR_LIMIT, UNITY_PITCH } from '../src/audio/akao/constants'
import { decodeAdpcm } from '../src/audio/akao/decodeAdpcm'
import { decodeAdsr } from '../src/audio/akao/decodeAdsr'
import { getPlaybackRate } from '../src/audio/akao/getPlaybackRate'
import { type AkaoBank, type AkaoInstrument, parseAkaoBank, parseAkaoFile } from '../src/audio/akao/parseAkaoFile'
import { advanceSongPosition, createSongPosition } from '../src/audio/akao/songPosition'

// Runs the engine's own parser, interpreter and sample decoder over every track on the disc and
// reports what they made of them.
//   node --import ./scripts/tsExtensionResolver.js scripts/validateAkao.ts

const MUSIC_DIRECTORY = 'extractor/data/converted/audio/music'
const TRACK_PREFIX = 'song_'
const RESIDENT_BANK_FILES = ['bank_00.akao', 'bank_20.akao']
const SIMULATED_SECONDS = 30
const DEFAULT_TEMPO = 26214

const totals = {
  banks: 0,
  detunedNotes: 0,
  heldNotes: 0,
  panOscillationSetups: 0,
  tremoloSetups: 0,
  vibratoSetups: 0,
  clampedNotes: 0,
  veryLowNotes: 0,
  fastestNote: 0,
  slowestNote: Number.POSITIVE_INFINITY,
  channels: 0,
  emptyInstruments: 0,
  instruments: 0,
  looping: 0,
  notes: 0,
  sampleSeconds: 0,
  silentAndFinished: 0,
  silentChannels: 0,
  tracks: 0,
  tracksNeedingAnotherBank: 0,
  envelopeOverrides: 0,
  drumModeNotes: 0,
  drumNotesWithoutKit: 0,
  drumKeysCovered: 0,
  drumTracks: 0,
  noiseNotes: 0,
  pitchSlides: 0,
  reverbDepthSlides: 0,
  tempoSlides: 0,
  timeSignatures: 0,
}

const problems: string[] = []
const silentTracks = new Set<string>()

const toBeatsPerMinute = (tempo: number) => (tempo * 300) / TEMPO_ACCUMULATOR_LIMIT

const readAkaoFile = (fileName: string) => {
  const data = readFileSync(join(MUSIC_DIRECTORY, fileName))
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

// Every bank loads into one runtime instrument table at the base its own block names, so a
// sequence addresses a resident bank and its own bank the same way.
const placeBank = (table: (AkaoInstrument | undefined)[], bank: AkaoBank | undefined) => {
  if (!bank) {
    return table
  }
  const placed = [...table]
  bank.instruments.forEach((instrument, index) => {
    placed[bank.instrumentBase + index] = instrument
  })
  return placed
}

// The two banks the driver keeps resident for the whole game, which never change with the track.
const residentInstruments = RESIDENT_BANK_FILES.reduce<(AkaoInstrument | undefined)[]>(
  (table, fileName) => placeBank(table, parseAkaoBank(readAkaoFile(fileName))),
  [],
)

const simulateTrack = (fileName: string, buffer: ArrayBuffer) => {
  const { bank, sequence } = parseAkaoFile(buffer)
  const drumKeysUsed = new Set<number>()
  totals.tracks += 1
  totals.channels += sequence.channelStartOffsets.length

  const instruments = placeBank(residentInstruments, bank)
  const instrumentCount = instruments.length
  const instrumentRegisters = instruments.map(
    (instrument) => instrument && { adsr1: instrument.adsr1, adsr2: instrument.adsr2 },
  )

  let tempo = DEFAULT_TEMPO
  let position = createSongPosition()
  let noiseClock = 0

  const song = {
    getKeyTranspose: () => 0,
    selectKeyTranspose: () => {},
    setMeasure: (measure: number) => {
      position = { ...position, measure }
    },
    setNoiseClock: (clock: number) => {
      noiseClock = clock
    },
    setReverbDepth: (_depth: number, _time: number, rampSeconds: number) => {
      if (rampSeconds > 0) {
        totals.reverbDepthSlides += 1
      }
    },
    setTempo: (value: number, rampTicks: number) => {
      tempo = value || DEFAULT_TEMPO
      if (rampTicks > 0) {
        totals.tempoSlides += 1
      }
    },
    setTimeSignature: (ticksPerBeat: number, beatsPerMeasure: number) => {
      totals.timeSignatures += 1
      position = { ...position, beatsPerMeasure, ticksPerBeat }
    },
  }

  if (sequence.drumRecords.length > 0) {
    totals.drumTracks += 1
  }

  const channels = sequence.channelStartOffsets.map(createChannelState)
  const noteCounts = channels.map(() => 0)
  const instrumentsUsed = new Set<number>()

  const voices = channels.map((channel, index) => {
    let isNoise = false
    return {
      keyOff: () => {},
      keyOn: ({
        adsr1,
        adsr2,
        detune,
        instrumentIndex,
        isHeld,
        semitone,
        slideSeconds,
      }: {
        adsr1: number
        adsr2: number
        detune: number
        instrumentIndex: number
        isHeld: boolean
        semitone: number
        slideSeconds: number
      }) => {
        noteCounts[index] += 1
        totals.notes += 1
        if (isHeld) {
          totals.heldNotes += 1
        }
        if (detune !== 0) {
          totals.detunedNotes += 1
        }
        if (slideSeconds > 0) {
          totals.pitchSlides += 1
        }
        if (isNoise) {
          totals.noiseNotes += 1
        }
        if (channel.isDrumMode) {
          totals.drumModeNotes += 1
          drumKeysUsed.add(channel.semitone)
          if (!instruments[instrumentIndex]) {
            totals.drumNotesWithoutKit += 1
          }
        }
        const instrument = instruments[instrumentIndex]
        if (instrument && (adsr1 !== instrument.adsr1 || adsr2 !== instrument.adsr2)) {
          totals.envelopeOverrides += 1
        }
        instrumentsUsed.add(instrumentIndex)
        if (semitone < 0 || semitone > 127) {
          problems.push(`${fileName} channel ${index}: semitone ${semitone} out of range`)
        }
        if (!Number.isFinite(decodeAdsr(adsr1, adsr2).releaseSeconds)) {
          problems.push(`${fileName} channel ${index}: envelope ${adsr1.toString(16)}/${adsr2.toString(16)} not finite`)
        }

        if (instrument) {
          const rate = getPlaybackRate(instrument, semitone, detune)
          totals.slowestNote = Math.min(totals.slowestNote, rate)
          totals.fastestNote = Math.max(totals.fastestNote, rate)
          if (rate < 1 / 8) {
            totals.veryLowNotes += 1
          }
          if (rate >= MAX_PITCH / UNITY_PITCH) {
            totals.clampedNotes += 1
          }
        }
      },
      setExpression: () => {},
      setNoise: (value: unknown) => {
        isNoise = value !== undefined
      },
      setPan: () => {},
      setPanOscillation: () => {
        totals.panOscillationSetups += 1
      },
      setPartVolume: () => {},
      setPitchModulationEnabled: () => {},
      setReverbEnabled: () => {},
      setTremolo: () => {
        totals.tremoloSetups += 1
      },
      setVibrato: () => {
        totals.vibratoSetups += 1
      },
      setVolume: () => {},
      slidePitch: () => {
        totals.pitchSlides += 1
      },
    }
  })

  let accumulator = 0
  let time = 0
  for (let interrupt = 0; interrupt < SIMULATED_SECONDS * INTERRUPT_HZ; interrupt += 1) {
    accumulator += tempo
    if (accumulator >= TEMPO_ACCUMULATOR_LIMIT) {
      accumulator -= TEMPO_ACCUMULATOR_LIMIT
      const tickSeconds = TEMPO_ACCUMULATOR_LIMIT / (INTERRUPT_HZ * tempo)
      channels.forEach((channel, index) => {
        const previousChannel = channels[index - 1]
        advanceChannel({
          channel,
          drumRecords: sequence.drumRecords,
          instrumentMaps: sequence.instrumentMaps,
          instrumentRegisters,
          noiseClock,
          previousChannelExpression: previousChannel?.expression ?? 127,
          previousChannelSemitone: previousChannel?.semitone ?? 0,
          song,
          stream: sequence.stream,
          tickSeconds,
          time,
          voice: voices[index],
        })
      })
      position = advanceSongPosition(position)
    }
    time += 1 / INTERRUPT_HZ
  }

  channels.forEach((channel, index) => {
    if (channel.cursor > sequence.stream.length) {
      problems.push(`${fileName} channel ${index}: cursor ran past the sequence`)
    }
    if (noteCounts[index] > 0) {
      return
    }
    totals.silentChannels += 1
    if (channel.isFinished) {
      totals.silentAndFinished += 1
      silentTracks.add(fileName)
    }
  })

  totals.drumKeysCovered += drumKeysUsed.size

  const unresolved = [...instrumentsUsed].filter((index) => !instruments[index])
  if (unresolved.length > 0) {
    problems.push(`${fileName}: instruments ${unresolved.join(',')} resolve to no bank (table holds ${instrumentCount})`)
    totals.tracksNeedingAnotherBank += 1
  }

  return { bpm: toBeatsPerMinute(tempo), measure: position.measure }
}

const checkBank = (fileName: string, buffer: ArrayBuffer) => {
  const { bank } = parseAkaoFile(buffer)
  if (!bank) {
    return
  }
  totals.banks += 1

  bank.instruments.forEach((instrument, index) => {
    totals.instruments += 1
    const sample = decodeAdpcm(bank.sampleData, instrument.sampleOffset, instrument.loopOffset)
    if (!sample) {
      totals.emptyInstruments += 1
      return
    }
    totals.sampleSeconds += sample.samples.length / 44100
    if (sample.isLooping) {
      totals.looping += 1
    }
    if (sample.loopStartIndex > sample.samples.length) {
      problems.push(`${fileName} instrument ${index}: loop point past the sample`)
    }

    const envelope = decodeAdsr(instrument.adsr1, instrument.adsr2)
    if (!Number.isFinite(envelope.attackSeconds + envelope.decaySeconds + envelope.releaseSeconds)) {
      problems.push(`${fileName} instrument ${index}: envelope is not finite`)
    }
  })
}

const files = readdirSync(MUSIC_DIRECTORY)
  .filter((name) => name.startsWith(TRACK_PREFIX) && name.endsWith('.akao'))
  .sort()

const tempos: number[] = []
const measures: number[] = []
files.forEach((fileName) => {
  const buffer = readAkaoFile(fileName)
  const { bpm, measure } = simulateTrack(fileName, buffer)
  tempos.push(bpm)
  measures.push(measure)
  checkBank(fileName, buffer)
})

console.log(totals)
console.log(
  'tempo range',
  Math.min(...tempos).toFixed(1),
  '-',
  Math.max(...tempos).toFixed(1),
  'BPM, non-integer tempos:',
  tempos.filter((bpm) => Math.abs(bpm - Math.round(bpm)) > 0.01).length,
)
console.log('tracks counting bars:', measures.filter((measure) => measure > 0).length)
console.log('tracks with a channel that ended without a note:', silentTracks.size)
console.log('problems:', problems.length)
problems.slice(0, 20).forEach((problem) => console.log(' ', problem))
