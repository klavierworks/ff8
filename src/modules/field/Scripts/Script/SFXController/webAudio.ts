import { MAX_SFX_VOLUME } from '../../../../../constants/audio'
import { getSoundFromId } from './utils'

export interface AudioSourceNode {
  buffer: AudioBuffer
  gainNode: GainNode
  id: number
  isLooping: boolean
  loopEnd: number | undefined
  loopStart: number | undefined
  panNode: StereoPannerNode
  source: AudioBufferSourceNode
}

let audioContext: AudioContext | null = null
let preloadedSoundBank: Record<number, AudioBuffer> = {}
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

const loadAudioBuffer = async (url: string): Promise<AudioBuffer> => {
  const context = await initializeAudioContext()

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return context.decodeAudioData(arrayBuffer)
}

export const preloadSound = async (soundId: number) => {
  const sound = getSoundFromId(soundId)
  const src = `/audio/effects/${sound}.mp3`

  try {
    const buffer = await loadAudioBuffer(src)
    preloadedSoundBank[soundId] = buffer
  } catch (error) {
    console.warn(`Failed to preload sound ${soundId}:`, error)
  }
}

export const preloadMapSoundBank = async (sounds: number[]): Promise<void> => {
  if (!sounds?.length) {
    return
  }

  preloadedSoundBank = {}

  const soundsToLoad = sounds.slice(0, 10)

  if ((soundsToLoad[0] as unknown as string) === 'no sounds available') {
    return
  }
  const loadPromises = soundsToLoad.map(preloadSound)

  await Promise.allSettled(loadPromises)
}

export const createAudioSource = async (
  id: number,
  volume: number,
  pan: number,
  loopPoints?: Record<number, [number, number]>,
): Promise<AudioSourceNode> => {
  const context = await initializeAudioContext()

  let buffer = preloadedSoundBank[id]
  if (!buffer) {
    const src = `/audio/effects/${id}.mp3`
    buffer = await loadAudioBuffer(src)
    preloadedSoundBank[id] = buffer
  }

  const source = context.createBufferSource()
  const gainNode = context.createGain()
  const panNode = context.createStereoPanner()

  source.buffer = buffer
  gainNode.gain.value = Math.max(0, Math.min(1, volume / MAX_SFX_VOLUME))
  panNode.pan.value = Math.max(-1, Math.min(1, (pan - 128) / 128))

  source.connect(gainNode)
  gainNode.connect(panNode)
  panNode.connect(context.destination)

  const loopPoint = loopPoints?.[id]
  const loopStart = loopPoint ? loopPoint[0] / 1000 : undefined
  const loopEnd = loopPoint ? loopPoint[1] / 1000 : undefined

  return {
    buffer,
    gainNode,
    id,
    isLooping: false,
    loopEnd,
    loopStart,
    panNode,
    source,
  }
}

export const setVolumeForSource = (sourceNode: AudioSourceNode, volume: number, duration?: number): void => {
  const targetVolume = Math.max(0, Math.min(1, volume / MAX_SFX_VOLUME))

  if (!duration) {
    sourceNode.gainNode.gain.value = targetVolume
    return
  }

  const context = sourceNode.gainNode.context
  const currentTime = context.currentTime
  sourceNode.gainNode.gain.cancelScheduledValues(currentTime)
  sourceNode.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + duration / 1000)
}

export const setPanForSource = (sourceNode: AudioSourceNode, pan: number, duration?: number): void => {
  const targetPan = Math.max(-1, Math.min(1, (pan - 128) / 128))

  if (!duration) {
    sourceNode.panNode.pan.value = targetPan
    return
  }

  const context = sourceNode.panNode.context
  const currentTime = context.currentTime
  sourceNode.panNode.pan.cancelScheduledValues(currentTime)
  sourceNode.panNode.pan.linearRampToValueAtTime(targetPan, currentTime + duration / 1000)
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

export const playWithLoop = (
  sourceNode: AudioSourceNode,
  onLoopStart?: (originalSource: AudioSourceNode) => Promise<void>,
): void => {
  const { loopEnd, loopStart, source } = sourceNode

  source.loop = false
  source.start()
  return
  if (!loopStart || !loopEnd) {
    source.loop = false
    source.start()
    return
  }

  console.log(`Playing intro for sound ${sourceNode.id}`)
  source.start(0, 0, loopStart)

  source.addEventListener('ended', () => {
    if (!sourceNode.isLooping && onLoopStart) {
      onLoopStart(sourceNode)
    }
  })
}
