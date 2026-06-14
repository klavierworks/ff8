import { Howl } from 'howler'
import { create } from 'zustand'

import { framesToMs } from '../timing'

const BASE_VOLUME = 0.4

type PreloadMusicOptions = {
  // Seconds into the track at which playback starts and where the looped
  // playhead returns at end-of-track. Used to skip an MP3 intro that the
  // AKAO/SGT sequencer would normally hide (e.g. "Ride On" has a ~20s intro
  // before the main theme begins). 0 disables intro-skip.
  loopStart?: number
}

const loopStartByHowl = new WeakMap<Howl, number>()

const applyLoopStart = (howl: Howl, loopStart: number) => {
  if (loopStart <= 0) {
    return
  }
  loopStartByHowl.set(howl, loopStart)
  // Howler's native loop wraps to position 0; reseek to loopStart on `end`
  // so the loop covers only the in-game theme, not the MP3 intro.
  howl.on('end', () => {
    howl.seek(loopStart)
  })
}

// Apply the intro-skip seek *before* play() — seeking after play() interrupts
// a simultaneous fade in crossMusic and causes audible ramp glitches.
const seekToLoopStartIfNeeded = (howl: Howl) => {
  const loopStart = loopStartByHowl.get(howl)
  if (loopStart === undefined) {
    return
  }
  howl.seek(loopStart)
}

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

  const preloadMusic = (url: string, options?: PreloadMusicOptions) => {
    const loopStart = options?.loopStart ?? 0
    const howl = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [url],
      volume: BASE_VOLUME,
    })
    applyLoopStart(howl, loopStart)
    preloadedAudio = howl
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

    seekToLoopStartIfNeeded(channel0)
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
    seekToLoopStartIfNeeded(incoming)
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

    seekToLoopStartIfNeeded(channel1!)
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
