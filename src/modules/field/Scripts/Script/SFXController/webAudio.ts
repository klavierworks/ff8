import type { DecodedWave } from '../../../../../audio/wave/decodeWaveFile'

import { decodeWaveFile } from '../../../../../audio/wave/decodeWaveFile'
import {
  FOOTSTEP_SOUNDS_FEMALE,
  FOOTSTEP_SOUNDS_LADDER,
  FOOTSTEP_SOUNDS_MALE,
  MAX_SFX_VOLUME,
} from '../../../../../constants/audio'
import { getSoundFromId } from './utils'

const SOUND_BASE_URL = '/audio/effects'
const PRELOADED_SOUND_COUNT = 10

// Preloaded on every map so a footfall never has to wait on a fetch.
const FOOTSTEP_SOUND_IDS = [FOOTSTEP_SOUNDS_MALE, FOOTSTEP_SOUNDS_FEMALE, FOOTSTEP_SOUNDS_LADDER].flatMap(
  ({ firstFoot, secondFoot }) => [firstFoot, secondFoot],
)

export type AudioSourceNode = {
  gainNode: GainNode
  isLooping: boolean
  panNode: StereoPannerNode
  source: AudioBufferSourceNode
}

let audioContext: AudioContext | null = null
let soundBank = new Map<number, Promise<DecodedWave>>()
let isUserActivationSetup = false

const initializeAudioContext = async (): Promise<AudioContext> => {
  if (!audioContext) {
    audioContext = new (
      window.AudioContext || (window as unknown as { webkitAudioContext: AudioContext }).webkitAudioContext
    )()
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  return audioContext
}

export const setupUserActivation = (): void => {
  if (isUserActivationSetup) {
    return
  }

  isUserActivationSetup = true

  const activateAudio = async () => {
    try {
      await initializeAudioContext()
    } catch (error) {
      console.warn('Failed to initialize audio context:', error)
    } finally {
      document.removeEventListener('click', activateAudio)
      document.removeEventListener('keydown', activateAudio)
      document.removeEventListener('touchstart', activateAudio)
    }
  }

  document.addEventListener('click', activateAudio, { once: true })
  document.addEventListener('keydown', activateAudio, { once: true })
  document.addEventListener('touchstart', activateAudio, { once: true })
}

const fetchSound = async (index: number): Promise<DecodedWave> => {
  const context = await initializeAudioContext()
  const response = await fetch(`${SOUND_BASE_URL}/${index}.wav`)
  if (!response.ok) {
    throw new Error(`Failed to fetch sound ${index}: ${response.status} ${response.statusText}`)
  }
  return decodeWaveFile(context, await response.arrayBuffer())
}

// Caching the pending decode means a sound asked for twice before it arrives is only fetched once.
const loadSound = (index: number) => {
  const cached = soundBank.get(index)
  if (cached) {
    return cached
  }

  const loading = fetchSound(index)
  soundBank.set(index, loading)
  loading.catch(() => soundBank.delete(index))
  return loading
}

export const preloadSound = async (soundId: number) => {
  try {
    await loadSound(getSoundFromId(soundId))
  } catch (error) {
    console.warn(`Failed to preload sound ${soundId}:`, error)
  }
}

const getMapSoundsToPreload = (sounds: number[]): number[] => {
  if (!sounds?.length) {
    return []
  }

  const soundsToLoad = sounds.slice(0, PRELOADED_SOUND_COUNT)
  if ((soundsToLoad[0] as unknown as string) === 'no sounds available') {
    return []
  }

  return soundsToLoad
}

export const preloadMapSoundBank = async (sounds: number[]): Promise<void> => {
  soundBank = new Map()

  await Promise.allSettled([...FOOTSTEP_SOUND_IDS, ...getMapSoundsToPreload(sounds)].map(preloadSound))
}

export const createAudioSource = async (id: number, volume: number, pan: number): Promise<AudioSourceNode> => {
  const context = await initializeAudioContext()
  const { buffer, sampleLoop } = await loadSound(id)

  const source = context.createBufferSource()
  const gainNode = context.createGain()
  const panNode = context.createStereoPanner()

  source.buffer = buffer
  if (sampleLoop) {
    source.loop = true
    source.loopStart = sampleLoop.start / buffer.sampleRate
    source.loopEnd = sampleLoop.end / buffer.sampleRate
  }

  gainNode.gain.value = Math.max(0, Math.min(1, volume / MAX_SFX_VOLUME))
  panNode.pan.value = Math.max(-1, Math.min(1, (pan - 128) / 128))

  source.connect(gainNode)
  gainNode.connect(panNode)
  panNode.connect(context.destination)

  return {
    gainNode,
    isLooping: sampleLoop !== undefined,
    panNode,
    source,
  }
}

// Browsers disagree on where a ramp with no preceding event starts, so the start value is pinned.
const rampParameterTo = (parameter: AudioParam, context: BaseAudioContext, value: number, durationMs: number): void => {
  const currentTime = context.currentTime
  const currentValue = parameter.value
  parameter.cancelScheduledValues(currentTime)
  parameter.setValueAtTime(currentValue, currentTime)
  parameter.linearRampToValueAtTime(value, currentTime + durationMs / 1000)
}

export const setVolumeForSource = (sourceNode: AudioSourceNode, volume: number, durationMs?: number): void => {
  const targetVolume = Math.max(0, Math.min(1, volume / MAX_SFX_VOLUME))

  if (!durationMs) {
    sourceNode.gainNode.gain.value = targetVolume
    return
  }

  rampParameterTo(sourceNode.gainNode.gain, sourceNode.gainNode.context, targetVolume, durationMs)
}

export const setPanForSource = (sourceNode: AudioSourceNode, pan: number, durationMs?: number): void => {
  const targetPan = Math.max(-1, Math.min(1, (pan - 128) / 128))

  if (!durationMs) {
    sourceNode.panNode.pan.value = targetPan
    return
  }

  rampParameterTo(sourceNode.panNode.pan, sourceNode.panNode.context, targetPan, durationMs)
}

export const stopSource = (sourceNode: AudioSourceNode): void => {
  try {
    sourceNode.source.stop()
    sourceNode.source.disconnect()
    sourceNode.gainNode.disconnect()
    sourceNode.panNode.disconnect()
  } catch (error) {
    console.warn('Error stopping audio source:', error)
  }
}

export const playSource = (sourceNode: AudioSourceNode): void => {
  sourceNode.source.start()
}
