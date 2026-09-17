import { Howl } from 'howler'

import { FULL_MUSIC_VOLUME, MUSIC_BASE_VOLUME, MUSIC_IDS, PSX_VOLUME_MASK } from '../constants/audio'
import { framesToMs } from '../timing'
import { getConcertSegmentUrls } from './concert'

const MUSIC_URLS: Record<number, string | undefined> = MUSIC_IDS

type PreloadMusic = (musicId: number, options?: PreloadMusicOptions) => void

type PreloadMusicOptions = {
  startMeasure?: number
}

const toHowlerVolume = (volume: number) => (volume / FULL_MUSIC_VOLUME) * MUSIC_BASE_VOLUME

const createLoopingTrack = (url: string) =>
  new Howl({ autoplay: true, loop: true, src: [url], volume: MUSIC_BASE_VOLUME })

const MusicController = () => {
  let preloadedAudio: Howl | undefined = undefined
  let preloadedSrc: string | undefined = undefined

  let channel0: Howl | undefined = undefined
  let channel0Src: string | undefined = undefined

  let channel1: Howl | undefined = undefined
  let channel1Src: string | undefined = undefined

  let overlayAudio: Howl | undefined = undefined

  let battleMusicId = 0

  const preloadMusic: PreloadMusic = (musicId) => {
    const url = MUSIC_URLS[musicId]
    if (!url) {
      console.warn('No recording for music id', musicId)
      return
    }

    preloadedAudio = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [url],
      volume: MUSIC_BASE_VOLUME,
    })
    preloadedSrc = url
  }

  const playMusic = () => {
    if (!preloadedAudio) {
      console.warn('No music preloaded, unable to play')
      return
    }

    if (preloadedSrc === channel0Src) {
      channel0?.pause()
      channel0?.play()
      return
    }

    channel0?.pause()

    channel0 = preloadedAudio
    channel0Src = preloadedSrc

    channel0.play()

    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  const crossMusic = (volume: number, fadeFrames: number) => {
    if (!preloadedAudio) {
      console.warn('No music preloaded for CROSSMUSIC')
      return
    }
    const targetVolume = toHowlerVolume(volume & PSX_VOLUME_MASK)
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
    if (preloadedSrc === channel1Src) {
      setVolume(1, volume)
      channel1?.pause()
      channel1?.play()
      return
    }

    channel1?.pause()
    channel1 = preloadedAudio
    channel1Src = preloadedSrc
    setVolume(1, volume)
    channel1?.play()

    preloadedAudio = undefined
    preloadedSrc = undefined
  }

  const replayMusic = () => {
    if (!channel0) {
      console.warn('No music on channel 0 to replay')
      return
    }
    channel0.stop()
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
    getChannelAudio(channelId)?.pause()
  }

  const setVolume = (channelId: number, volume: number) => {
    getChannelAudio(channelId)?.volume(toHowlerVolume(volume))
  }

  const getHasPendingMusic = () => preloadedAudio !== undefined

  const restoreChannelVolumes = () => {
    channel0?.volume(MUSIC_BASE_VOLUME)
    channel1?.volume(MUSIC_BASE_VOLUME)
  }

  const transitionVolume = (channelId: number, volume: number, duration: number) => {
    const audio = getChannelAudio(channelId)
    if (!audio) {
      return
    }
    audio.fade(audio.volume(), toHowlerVolume(volume), framesToMs(duration))
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
