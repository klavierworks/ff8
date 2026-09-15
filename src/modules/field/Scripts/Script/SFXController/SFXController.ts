import { create } from 'zustand'

import { MAX_SFX_VOLUME, SFX_PAN_CENTRE } from '../../../../../constants/audio'
import { FieldData } from '../../../Field'
import { getSoundFromId } from './utils'
import {
  AudioSourceNode,
  createAudioSource,
  playSource,
  setPanForSource,
  setupUserActivation,
  setVolumeForSource,
  stopSource,
} from './webAudio'

type SFXControllerState = {
  channels: Record<number, AudioSourceNode[]>
  generalChannel: AudioSourceNode[]
  id: number | string
}

const GENERAL_CHANNEL = 0

const createSFXController = (id: number | string, sounds: FieldData['sounds']) => {
  setupUserActivation()

  const { getState, setState } = create<SFXControllerState>(() => ({
    channels: {},
    generalChannel: [],
    id,
  }))

  const addSourceToChannel = (sourceNode: AudioSourceNode, channel: number): void => {
    const state = getState()

    if (channel === GENERAL_CHANNEL) {
      setState({
        ...state,
        generalChannel: [...state.generalChannel, sourceNode],
      })
      return
    }

    setState({
      ...state,
      channels: {
        ...state.channels,
        [channel]: [...(state.channels[channel] || []), sourceNode],
      },
    })
  }

  const removeSourceFromChannel = (sourceNode: AudioSourceNode): void => {
    const state = getState()
    const withoutSource = (nodes: AudioSourceNode[]) => nodes.filter((node) => node !== sourceNode)

    setState({
      ...state,
      channels: Object.fromEntries(Object.entries(state.channels).map(([key, nodes]) => [key, withoutSource(nodes)])),
      generalChannel: withoutSource(state.generalChannel),
    })
  }

  const play = async (id: number, channel: number, volume: number, pan: number): Promise<void> => {
    try {
      const sourceNode = await createAudioSource(id, volume, pan)
      addSourceToChannel(sourceNode, channel)

      // Without this the channel lists grow for the lifetime of the field. A looping sound never
      // ends on its own, so it leaves only when the script stops its channel.
      sourceNode.source.addEventListener('ended', () => {
        if (sourceNode.isLooping) {
          return
        }
        removeSourceFromChannel(sourceNode)
      })

      playSource(sourceNode)
    } catch (error) {
      console.error(`Failed to play sound ${id}:`, error)
    }
  }

  const playFieldSound = async (index: number, channel: number, volume: number, pan: number): Promise<void> => {
    const sound = getSoundFromId(sounds[index])

    if (!sound) {
      console.warn('No sound at index', index, 'in field data.')
      return
    }

    await play(sound, channel, volume, pan)
  }

  const getExistingSourcesByChannel = (channel?: number): AudioSourceNode[] => {
    const { channels, generalChannel } = getState()

    if (channel === undefined) {
      return [...generalChannel, ...Object.values(channels).flat()]
    }

    if (channel === GENERAL_CHANNEL) {
      return generalChannel
    }

    return channels[channel] || []
  }

  const stop = (channel?: number): void => {
    const state = getState()
    const sources = getExistingSourcesByChannel(channel)

    sources.forEach(stopSource)

    if (channel === undefined) {
      setState({ ...state, channels: {}, generalChannel: [] })
      return
    } else if (channel === GENERAL_CHANNEL) {
      setState({ ...state, generalChannel: [] })
    } else {
      setState({
        ...state,
        channels: { ...state.channels, [channel]: [] },
      })
    }
  }

  const setVolume = (channel: number | undefined, volume: number, duration?: number): void => {
    const sources = getExistingSourcesByChannel(channel)
    sources.forEach((source) => setVolumeForSource(source, volume, duration))
  }

  const setPan = (channel: number | undefined, pan: number, duration?: number): void => {
    const sources = getExistingSourcesByChannel(channel)
    sources.forEach((source) => setPanForSource(source, pan, duration))
  }

  const reset = (): void => {
    setVolume(undefined, MAX_SFX_VOLUME)
    setPan(undefined, SFX_PAN_CENTRE)
    stop()
  }

  return {
    play,
    playFieldSound,
    reset,
    setPan,
    setVolume,
    stop,
  }
}

export default createSFXController
