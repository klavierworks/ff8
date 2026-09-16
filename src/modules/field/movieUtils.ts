import manifest from '@data/movies/manifest.json'

import type { FieldData } from './Field'

import {
  FIRST_PUBLISH_DISC,
  MOVIE_CAMERA_AXIS_OFFSETS,
  MOVIE_CAMERA_EXTENSION,
  MOVIE_CAMERA_FLAGS_OFFSET,
  MOVIE_CAMERA_HEADER_SIZE,
  MOVIE_CAMERA_LAST_FRAME_OFFSET,
  MOVIE_CAMERA_POSITION_OFFSETS,
  MOVIE_CAMERA_RECORD_SIZE,
  MOVIE_CAMERA_ZOOM_OFFSET,
  MOVIE_EXTENSION,
  MOVIE_FLAGS_HIDING_MODELS,
  MOVIES_PATH,
} from '../../constants/movies'

export type MovieCameraBlock = {
  frames: MovieCameraFrame[]
  lastFrame: number
}

export type MovieCameraFrame = {
  camera: FieldData['cameras'][number]
  flags: number
}

export type MovieRecord = (typeof manifest)[number]

const getMovieSource = (disc: number) => (disc >= FIRST_PUBLISH_DISC ? 'publish' : `disc${disc}`)

export const findMovieRecord = (disc: number, movieId: number) =>
  manifest.find((record) => record.source === getMovieSource(disc) && record.index === movieId)

export const getMovieUrl = (record: MovieRecord) => `${MOVIES_PATH}/${record.name}.${MOVIE_EXTENSION}`

export const getMovieCameraUrl = (record: MovieRecord) => `${MOVIES_PATH}/${record.name}.${MOVIE_CAMERA_EXTENSION}`

const readCameraAxis = (view: DataView, offset: number) => ({
  x: view.getInt16(offset, true),
  y: view.getInt16(offset + 2, true),
  z: view.getInt16(offset + 4, true),
})

const readCameraFrame = (view: DataView, index: number): MovieCameraFrame => {
  const offset = MOVIE_CAMERA_HEADER_SIZE + index * MOVIE_CAMERA_RECORD_SIZE

  return {
    camera: {
      camera_axis: MOVIE_CAMERA_AXIS_OFFSETS.map((axisOffset) => readCameraAxis(view, offset + axisOffset)),
      camera_position: MOVIE_CAMERA_POSITION_OFFSETS.map((positionOffset) =>
        view.getInt32(offset + positionOffset, true),
      ),
      camera_zoom: view.getUint16(offset + MOVIE_CAMERA_ZOOM_OFFSET, true),
      index,
    },
    flags: view.getUint8(offset + MOVIE_CAMERA_FLAGS_OFFSET),
  }
}

export const parseMovieCameraBlock = (buffer: ArrayBuffer): MovieCameraBlock => {
  const view = new DataView(buffer)
  const frameCount = Math.floor((buffer.byteLength - MOVIE_CAMERA_HEADER_SIZE) / MOVIE_CAMERA_RECORD_SIZE)

  return {
    frames: Array.from({ length: frameCount }, (_, index) => readCameraFrame(view, index)),
    lastFrame: view.getUint16(MOVIE_CAMERA_LAST_FRAME_OFFSET, true),
  }
}

export const getIsHidingModels = (frame: MovieCameraFrame | undefined) =>
  frame === undefined || (frame.flags & MOVIE_FLAGS_HIDING_MODELS) !== 0

export const getPresentedFrameIndex = (mediaTime: number, fps: number) => Math.round(mediaTime * fps)
