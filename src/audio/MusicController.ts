import { Howl } from 'howler'

import { FULL_MUSIC_VOLUME, MUSIC_BASE_VOLUME, MUSIC_IDS, PSX_VOLUME_MASK } from '../constants/audio'
import { framesToMs } from '../timing'
import { getConcertSegmentUrls } from './concert'

const MUSIC_URLS: Record<number, string | undefined> = MUSIC_IDS

type PreloadMusicOptions = {
  // Seconds into the track at which playback starts and where the looped
  // playhead returns at end-of-track. Used to skip an MP3 intro that the
  // AKAO/SGT sequencer would normally hide (e.g. "Ride On" has a ~20s intro
  // before the main theme begins). 0 disables intro-skip.
  loopStart?: number
}

const loopStartByHowl = new WeakMap<Howl, number>()

const createLoopingTrack = (url: string) =>
  new Howl({ autoplay: true, loop: true, src: [url], volume: MUSIC_BASE_VOLUME })

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

  // A temporary track that takes over while a self-contained overlay (e.g. the Triple Triad
  // card game) is active. The field track on channel 0 is paused, not replaced, so it can
  // resume exactly where it left off when the overlay closes.
  let overlayAudio: Howl | undefined = undefined

  let battleMusicId = 0

  const preloadMusic = (musicId: number, options?: PreloadMusicOptions) => {
    const url = MUSIC_URLS[musicId]
    if (!url) {
      console.warn('No recording for music id', musicId)
      return
    }

    const loopStart = options?.loopStart ?? 0
    const howl = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [url],
      volume: MUSIC_BASE_VOLUME,
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
    const targetVolume = ((volume & PSX_VOLUME_MASK) / FULL_MUSIC_VOLUME) * MUSIC_BASE_VOLUME
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
    setVolume(1, volume * MUSIC_BASE_VOLUME)

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

  const replayMusic = () => {
    if (!channel0) {
      console.warn('No music on channel 0 to replay')
      return
    }
    channel0.stop()
    seekToLoopStartIfNeeded(channel0)
    channel0.play()
  }

  const playConcert = (mask: number, fieldId: string | undefined) => {
    const [firstUrl, secondUrl] = getConcertSegmentUrls(mask, fieldId)
    if (!firstUrl) {
      return
    }

    channel0?.stop()
    channel1?.stop()
    preloadedAudio = undefined
    preloadedSrc = undefined

    channel0 = createLoopingTrack(firstUrl)
    channel0Src = firstUrl

    channel1 = secondUrl ? createLoopingTrack(secondUrl) : undefined
    channel1Src = secondUrl
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
    audio.volume((volume / FULL_MUSIC_VOLUME) * MUSIC_BASE_VOLUME)
  }

  const getHasPendingMusic = () => preloadedAudio !== undefined

  // Bypasses getChannelAudio because an empty channel is expected here, not
  // something to warn about.
  const restoreChannelVolumes = () => {
    channel0?.volume(MUSIC_BASE_VOLUME)
    channel1?.volume(MUSIC_BASE_VOLUME)
  }

  const transitionVolume = (channelId: number, volume: number, duration: number) => {
    const audio = getChannelAudio(channelId)
    if (!audio) {
      return
    }
    audio.fade(audio.volume(), (volume / FULL_MUSIC_VOLUME) * MUSIC_BASE_VOLUME, framesToMs(duration))
  }

  const setBattleMusic = (musicId: number) => {
    battleMusicId = musicId
  }

  const getBattleMusicId = () => battleMusicId

  const playOverlayMusic = (musicId: number) => {
    const url = MUSIC_URLS[musicId]
    if (!url) {
      console.warn('No recording for music id', musicId)
      return
    }

    channel0?.pause()
    overlayAudio?.stop()
    overlayAudio = createLoopingTrack(url)
  }

  const stopOverlayMusic = () => {
    if (overlayAudio) {
      overlayAudio.stop()
      overlayAudio = undefined
    }
    channel0?.play()
  }

  const reset = () => {
    channel0?.stop()
    channel1?.stop()
    overlayAudio?.stop()
    preloadedAudio?.unload()
    channel0 = undefined
    channel0Src = undefined
    channel1 = undefined
    channel1Src = undefined
    overlayAudio = undefined
    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  return {
    crossMusic,
    dualMusic,
    getBattleMusicId,
    getHasPendingMusic,
    pauseChannel,
    playConcert,
    playMusic,
    playOverlayMusic,
    preloadMusic,
    replayMusic,
    reset,
    restoreChannelVolumes,
    setBattleMusic,
    setVolume,
    stopOverlayMusic,
    transitionVolume,
  }
}

export default MusicController

export const musicController = MusicController()
