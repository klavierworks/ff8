import { create } from 'zustand'

import useGlobalStore from '../../store'
import {
  findMovieRecord,
  getIsHidingModels,
  getMovieCameraUrl,
  getMovieUrl,
  getPresentedFrameIndex,
  MovieCameraFrame,
  MovieRecord,
  parseMovieCameraBlock,
} from './movieUtils'

type LoadedMovie = {
  cameraFrames: MovieCameraFrame[] | undefined
  fps: number
  lastFrame: number
  video: HTMLVideoElement
}

type MovieSession = {
  frame: number
  isActive: boolean
  isFieldMovieMode: boolean
  playingMovie: LoadedMovie | undefined
  presentedFrameIndex: number
}

const loadVideo = (url: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.addEventListener('canplaythrough', () => resolve(video), { once: true })
    video.addEventListener('error', () => reject(video.error), { once: true })
    video.src = url
    video.load()
  })

const releaseVideo = (video: HTMLVideoElement) => {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

const unmuteOnFirstInteraction = (video: HTMLVideoElement) => {
  const abortController = new AbortController()
  const handleInteraction = () => {
    video.muted = false
    abortController.abort()
  }
  window.addEventListener('keydown', handleInteraction, { signal: abortController.signal })
  window.addEventListener('pointerdown', handleInteraction, { signal: abortController.signal })
}

// Browsers refuse audible playback until the page has had a click or key press,
// which is the case when a movie map is opened straight from the URL.
const playVideo = async (video: HTMLVideoElement) => {
  try {
    await video.play()
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
      throw error
    }
    video.muted = true
    await video.play()
    unmuteOnFirstInteraction(video)
  }
}

const loadCameraFrames = async (record: MovieRecord) => {
  if (!record.hasCamera) {
    return undefined
  }
  const response = await fetch(getMovieCameraUrl(record))
  if (!response.ok) {
    throw new Error(`Failed to fetch ${getMovieCameraUrl(record)}: ${response.status}`)
  }
  return parseMovieCameraBlock(await response.arrayBuffer())
}

const loadMovie = async (disc: number, movieId: number): Promise<LoadedMovie | undefined> => {
  const record = findMovieRecord(disc, movieId)
  if (!record) {
    console.warn(`No movie ${movieId} for disc ${disc}`)
    return undefined
  }
  try {
    const [video, cameraBlock] = await Promise.all([loadVideo(getMovieUrl(record)), loadCameraFrames(record)])
    return {
      cameraFrames: cameraBlock?.frames,
      fps: record.fps,
      lastFrame: cameraBlock?.lastFrame ?? record.frameCount - 1,
      video,
    }
  } catch (error) {
    console.error(`Failed to load movie ${record.name}`, error)
    return undefined
  }
}

const createMovieController = () => {
  const store = create<MovieSession>(() => ({
    frame: 0,
    isActive: false,
    isFieldMovieMode: false,
    playingMovie: undefined,
    presentedFrameIndex: 0,
  }))
  const { getState, setState } = store

  let pendingMovie: Promise<LoadedMovie | undefined> | undefined

  const finishMovie = (movie: LoadedMovie | undefined) => {
    if (getState().playingMovie !== movie) {
      return
    }
    if (movie) {
      releaseVideo(movie.video)
    }
    setState({ isActive: false, isFieldMovieMode: false, playingMovie: undefined })
  }

  const trackPresentedFrames = (movie: LoadedMovie) => {
    const handleVideoFrame = (_: number, metadata: VideoFrameCallbackMetadata) => {
      if (getState().playingMovie !== movie) {
        return
      }
      const presentedFrameIndex = getPresentedFrameIndex(metadata.mediaTime, movie.fps)
      setState({ frame: presentedFrameIndex + 1, presentedFrameIndex })
      if (presentedFrameIndex >= movie.lastFrame) {
        finishMovie(movie)
        return
      }
      movie.video.requestVideoFrameCallback(handleVideoFrame)
    }
    movie.video.requestVideoFrameCallback(handleVideoFrame)
    movie.video.addEventListener('ended', () => finishMovie(movie), { once: true })
  }

  const releasePendingMovie = (previousMovie: Promise<LoadedMovie | undefined>) => {
    previousMovie.then((movie) => {
      if (movie && movie !== getState().playingMovie) {
        releaseVideo(movie.video)
      }
    })
  }

  const prepareMovie = (disc: number, movieId: number) => {
    const { playingMovie } = getState()
    if (playingMovie) {
      releaseVideo(playingMovie.video)
    }
    if (pendingMovie) {
      releasePendingMovie(pendingMovie)
    }
    pendingMovie = loadMovie(disc, movieId)
    setState({ frame: 0, isActive: false, isFieldMovieMode: true, playingMovie: undefined, presentedFrameIndex: 0 })
  }

  // The engine raises the active flag even with nothing prepared, and only a
  // movie finishing or the next MOVIEREADY lowers it again.
  const startMovie = async () => {
    setState({ isActive: true })
    const requestedMovie = pendingMovie
    if (!requestedMovie) {
      return
    }
    const movie = await requestedMovie
    if (requestedMovie !== pendingMovie) {
      return
    }
    pendingMovie = undefined
    if (!movie) {
      setState({ isActive: false, isFieldMovieMode: false })
      return
    }

    setState({ frame: 0, playingMovie: movie, presentedFrameIndex: 0 })
    trackPresentedFrames(movie)
    try {
      await playVideo(movie.video)
    } catch (error) {
      console.error('Failed to play movie', error)
      finishMovie(movie)
    }
  }

  const getCurrentCameraFrame = () => {
    const { playingMovie, presentedFrameIndex } = getState()
    return playingMovie?.cameraFrames?.[presentedFrameIndex]
  }

  const getIsReplacingField = () => {
    const { isActive, isFieldMovieMode } = getState()
    return isActive && isFieldMovieMode
  }

  const getIsHidingFieldModels = () =>
    getState().playingMovie !== undefined && getIsHidingModels(getCurrentCameraFrame())

  const getIsFieldDrawSuppressedDuringMovie = () =>
    getState().playingMovie !== undefined && useGlobalStore.getState().isFieldDrawSuppressed

  const getMovieCamera = () => (getIsReplacingField() ? getCurrentCameraFrame()?.camera : undefined)

  return {
    getIsFieldDrawSuppressedDuringMovie,
    getIsHidingFieldModels,
    getIsReplacingField,
    getMovieCamera,
    prepareMovie,
    startMovie,
    store,
  }
}

export const movieController = createMovieController()

export const useMovieStore = movieController.store
