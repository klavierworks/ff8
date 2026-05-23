import { Howl } from 'howler'
import { create } from 'zustand'

import { framesToMs } from '../timing'

const BASE_VOLUME = 0.4

const MusicController = () => {
  let preloadedAudio: Howl | undefined = undefined
  let preloadedSrc: string | undefined = undefined

  let channel0: Howl | undefined = undefined
  let channel0Src: string | undefined = undefined

  let channel1: Howl | undefined = undefined
  let channel1Src: string | undefined = undefined

  const { setState } = create(() => ({
    battleMusicId: 0,
  }))

  const preloadMusic = (url: string) => {
    preloadedAudio = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [url],
      volume: BASE_VOLUME,
    })
    preloadedSrc = url
  }

  const playMusic = () => {
    if (!preloadedAudio) {
      console.warn('No music preloaded, unable to play')
      return
    }

    if (preloadedSrc === channel0Src) {
      channel0!.pause()
      channel0!.play()
      return
    }

    if (channel0) {
      channel0.pause()
    }

    channel0 = preloadedAudio
    channel0Src = preloadedSrc

    channel0.play()

    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  // Crossfade the preloaded track in on channel 0, fading any existing
  // track out over the same duration. Volume is a 0–127 PSX/AKAO value.
  const crossMusic = (volume: number, fadeFrames: number) => {
    if (!preloadedAudio) {
      console.warn('No music preloaded for CROSSMUSIC')
      return
    }
    const targetVolume = ((volume & 0x7f) / 127) * BASE_VOLUME
    const fadeMs = framesToMs(fadeFrames)

    if (preloadedSrc === channel0Src && channel0) {
      channel0.fade(channel0.volume(), targetVolume, fadeMs)
      preloadedAudio = undefined
      preloadedSrc = undefined
      return
    }

    if (channel0) {
      const outgoing = channel0
      outgoing.fade(outgoing.volume(), 0, fadeMs)
      outgoing.once('fade', () => {
        outgoing.stop()
      })
    }

    const incoming = preloadedAudio
    incoming.volume(0)
    incoming.play()
    incoming.fade(0, targetVolume, fadeMs)

    channel0 = incoming
    channel0Src = preloadedSrc
    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  const dualMusic = (volume: number) => {
    setVolume(1, volume * BASE_VOLUME)

    if (preloadedSrc === channel1Src) {
      channel1!.pause()
      channel1!.play()
      return
    }

    if (channel1) {
      channel1.pause()
    }

    channel1 = preloadedAudio
    channel1Src = preloadedSrc

    channel1!.play()

    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  const getChannelAudio = (channelId: number) => {
    const audio = channelId === 0 ? channel0 : channel1
    if (!audio) {
      console.warn('No audio on channel', channelId)
      return
    }
    return audio
  }

  const pauseChannel = (channelId: number) => {
    const audio = getChannelAudio(channelId)
    if (!audio) {
      return
    }
    audio.pause()
  }

  const setVolume = (channelId: number, volume: number) => {
    const audio = getChannelAudio(channelId)
    if (!audio) {
      return
    }
    audio.volume((volume / 127) * BASE_VOLUME)
  }

  const transitionVolume = (channelId: number, volume: number, duration: number) => {
    const audio = getChannelAudio(channelId)
    if (!audio) {
      return
    }
    audio.fade(audio.volume(), (volume / 127) * BASE_VOLUME, framesToMs(duration))
  }

  const setBattleMusic = (musicId: number) => {
    setState({ battleMusicId: musicId })
  }

  const reset = () => {
    channel0?.stop()
    channel1?.stop()
    preloadedAudio?.unload()
    channel0 = undefined
    channel0Src = undefined
    channel1 = undefined
    channel1Src = undefined
    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  return {
    crossMusic,
    dualMusic,
    pauseChannel,
    playMusic,
    preloadMusic,
    reset,
    setBattleMusic,
    setVolume,
    transitionVolume,
  }
}

export default MusicController
