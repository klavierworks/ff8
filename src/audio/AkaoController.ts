import { FULL_MUSIC_VOLUME, MUSIC_BASE_VOLUME, PSX_VOLUME_MASK } from '../constants/audio'
import { framesToSeconds } from '../timing'
import { type AkaoTrack, createAkaoTrack } from './akao/akaoTrack'
import { type AkaoTrackData, hasAkaoTrack, loadAkaoTrack } from './akao/loadAkaoTrack'
import { CONCERT_MUSIC_ID, getConcertChannelMask } from './concert'

const OVERLAY_CHANNEL = 2
const CHANNEL_COUNT = 3

type MusicChannel = {
  musicId: number
  track: AkaoTrack
}

// loopStart exists for parity with the recorded controller; AKAO sequences carry their own loop
// points.
type PreloadMusic = (musicId: number, options?: PreloadMusicOptions) => void

type PreloadMusicOptions = {
  loopStart?: number
}

type StartOptions = {
  channelMask?: number
  fadeSeconds?: number
  musicId: number
  trackData: Promise<AkaoTrackData>
  volume: number
}

// Safari re-suspends the context every time the page is hidden, so these listeners stay attached
// rather than unhooking after the first gesture.
const keepContextRunning = (audioContext: AudioContext) => {
  const resume = () => {
    if (audioContext.state === 'running') {
      return
    }
    audioContext.resume().catch(() => undefined)
  }

  window.addEventListener('keydown', resume)
  window.addEventListener('pointerdown', resume)
  document.addEventListener('visibilitychange', resume)
}

const AkaoController = () => {
  const channels: (MusicChannel | undefined)[] = Array.from({ length: CHANNEL_COUNT })
  // Starting a track has to wait for its samples, so a slot that has been asked for a newer track
  // ignores the one it asked for first.
  const requestIds = channels.map(() => 0)

  let audio: undefined | { context: AudioContext; masterGain: GainNode }
  let pendingTrack: undefined | { musicId: number; trackData: Promise<AkaoTrackData> }
  let battleMusicId = 0

  const getAudio = () => {
    if (!audio) {
      const context = new AudioContext()
      const masterGain = context.createGain()
      masterGain.gain.value = MUSIC_BASE_VOLUME
      masterGain.connect(context.destination)
      keepContextRunning(context)
      audio = { context, masterGain }
    }
    return audio
  }

  const releaseChannel = (channelIndex: number, fadeSeconds: number) => {
    const current = channels[channelIndex]
    channels[channelIndex] = undefined
    requestIds[channelIndex] += 1
    if (!current) {
      return
    }
    if (fadeSeconds <= 0) {
      current.track.dispose()
      return
    }
    current.track.transitionVolume(0, fadeSeconds)
    window.setTimeout(() => current.track.dispose(), fadeSeconds * 1000)
  }

  const startOnChannel = (channelIndex: number, options: StartOptions) => {
    const { channelMask, fadeSeconds, musicId, trackData, volume } = options
    const { context, masterGain } = getAudio()
    const requestId = requestIds[channelIndex] + 1
    requestIds[channelIndex] = requestId

    trackData
      .then((data) => {
        if (requestIds[channelIndex] !== requestId) {
          return
        }
        const track = createAkaoTrack({
          audioContext: context,
          channelMask,
          data,
          destination: masterGain,
          volume: fadeSeconds ? 0 : volume,
        })
        channels[channelIndex] = { musicId, track }
        track.start()
        if (fadeSeconds) {
          track.transitionVolume(volume, fadeSeconds)
        }
      })
      .catch((error: unknown) => {
        console.warn('Unable to start AKAO music', musicId, error)
      })
  }

  const takePending = () => {
    const requested = pendingTrack
    pendingTrack = undefined
    return requested
  }

  const preloadMusic: PreloadMusic = (musicId) => {
    if (!hasAkaoTrack(musicId)) {
      console.warn('No AKAO sequence for music id', musicId)
      pendingTrack = undefined
      return
    }
    pendingTrack = { musicId, trackData: loadAkaoTrack(getAudio().context, musicId) }
  }

  const playMusic = () => {
    const requested = takePending()
    if (!requested) {
      console.warn('No music preloaded, unable to play')
      return
    }

    if (requested.musicId === channels[0]?.musicId) {
      channels[0].track.resume()
      return
    }

    releaseChannel(0, 0)
    startOnChannel(0, { ...requested, volume: FULL_MUSIC_VOLUME })
  }

  const crossMusic = (volume: number, fadeFrames: number) => {
    const requested = takePending()
    if (!requested) {
      console.warn('No music preloaded for CROSSMUSIC')
      return
    }

    const fadeSeconds = framesToSeconds(fadeFrames)
    const targetVolume = volume & PSX_VOLUME_MASK

    if (requested.musicId === channels[0]?.musicId) {
      channels[0].track.transitionVolume(targetVolume, fadeSeconds)
      return
    }

    releaseChannel(0, fadeSeconds)
    startOnChannel(0, { ...requested, fadeSeconds, volume: targetVolume })
  }

  const dualMusic = (volume: number) => {
    const requested = takePending()
    if (!requested) {
      console.warn('No music preloaded for DUALMUSIC')
      return
    }

    if (requested.musicId === channels[1]?.musicId) {
      channels[1].track.resume()
      channels[1].track.setVolume(volume)
      return
    }

    releaseChannel(1, 0)
    startOnChannel(1, { ...requested, volume })
  }

  const replayMusic = () => {
    const current = channels[0]
    if (!current) {
      console.warn('No music on channel 0 to replay')
      return
    }
    current.track.start()
  }

  const playConcert = (mask: number, fieldId: string | undefined) => {
    const channelMask = getConcertChannelMask(mask, fieldId)
    if (channelMask === 0) {
      return
    }

    takePending()
    releaseChannel(0, 0)
    releaseChannel(1, 0)
    startOnChannel(0, {
      channelMask,
      musicId: CONCERT_MUSIC_ID,
      trackData: loadAkaoTrack(getAudio().context, CONCERT_MUSIC_ID),
      volume: FULL_MUSIC_VOLUME,
    })
  }

  const getChannelTrack = (channelIndex: number) => {
    const current = channels[channelIndex]
    if (!current) {
      console.warn('No audio on channel', channelIndex)
      return
    }
    return current.track
  }

  const pauseChannel = (channelIndex: number) => {
    getChannelTrack(channelIndex)?.pause()
  }

  const setVolume = (channelIndex: number, volume: number) => {
    getChannelTrack(channelIndex)?.setVolume(volume)
  }

  const transitionVolume = (channelIndex: number, volume: number, duration: number) => {
    getChannelTrack(channelIndex)?.transitionVolume(volume, framesToSeconds(duration))
  }

  const restoreChannelVolumes = () => {
    channels[0]?.track.setVolume(FULL_MUSIC_VOLUME)
    channels[1]?.track.setVolume(FULL_MUSIC_VOLUME)
  }

  const playOverlayMusic = (musicId: number) => {
    if (!hasAkaoTrack(musicId)) {
      console.warn('No AKAO sequence for music id', musicId)
      return
    }
    channels[0]?.track.pause()
    releaseChannel(OVERLAY_CHANNEL, 0)
    startOnChannel(OVERLAY_CHANNEL, {
      musicId,
      trackData: loadAkaoTrack(getAudio().context, musicId),
      volume: FULL_MUSIC_VOLUME,
    })
  }

  const stopOverlayMusic = () => {
    releaseChannel(OVERLAY_CHANNEL, 0)
    channels[0]?.track.resume()
  }

  const setBattleMusic = (musicId: number) => {
    battleMusicId = musicId
  }

  const getBattleMusicId = () => battleMusicId

  const reset = () => {
    channels.forEach((_, index) => releaseChannel(index, 0))
    pendingTrack = undefined
  }

  return {
    crossMusic,
    dualMusic,
    getBattleMusicId,
    getHasPendingMusic: () => pendingTrack !== undefined,
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

export default AkaoController

export const akaoController = AkaoController()
