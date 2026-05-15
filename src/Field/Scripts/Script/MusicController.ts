import { Howl } from 'howler'
import { create } from 'zustand'

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

  const preloadMusic = (src: string) => {
    preloadedAudio = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [src],
      volume: BASE_VOLUME,
    })
    preloadedSrc = src
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
    audio.fade(audio.volume(), (volume / 127) * BASE_VOLUME, duration * 30)
  }

  const setBattleMusic = (musicId: number) => {
    setState({ battleMusicId: musicId })
  }

  return {
    dualMusic,
    pauseChannel,
    playMusic,
    preloadMusic,
    setBattleMusic,
    setVolume,
    transitionVolume,
  }
}

export default MusicController
