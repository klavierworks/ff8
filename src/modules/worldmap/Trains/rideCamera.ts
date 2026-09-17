import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import {
  RIDE_CAMERA_ABSOLUTE_ALTITUDE_ANCHOR,
  RIDE_CAMERA_LERP_TO_NEXT,
  RIDE_CAMERA_PROGRESS_ONE,
  RIDE_CAMERA_RELATIVE_ANCHOR,
  RIDE_CAMERA_STATION_MARKER,
  RIDE_CAMERA_TRACK_END,
} from '../../../constants/worldmapTrains'
import { TrainCar, TrainDirection } from './trainCars'

export type PsxVector = {
  altitude: number
  x: number
  z: number
}
export type RideCameraTrack = WorldmapSections['section_17_ride_camera_tracks']['groups'][number]['tracks'][number]

export type RideCameraView = {
  eye: PsxVector
  target: PsxVector
}

type RideCameraKey = RideCameraTrack[number]

const toInt16 = (value: number) => (value << 16) >> 16

const findActiveKeyIndex = (track: RideCameraTrack, frame: number) => {
  const index = track.findIndex(
    (key) =>
      key.frame === RIDE_CAMERA_TRACK_END || (key.frame !== RIDE_CAMERA_STATION_MARKER && frame - key.frame <= 0),
  )
  return index === -1 ? track.length - 1 : index
}

const calculateKeyProgress = (track: RideCameraTrack, keyIndex: number, frame: number) => {
  const key = track[keyIndex]
  if (key.frame === RIDE_CAMERA_TRACK_END) {
    return RIDE_CAMERA_PROGRESS_ONE
  }
  const previousFrame = keyIndex === 0 ? 0 : track[keyIndex - 1].frame
  if (key.frame <= previousFrame) {
    return RIDE_CAMERA_PROGRESS_ONE
  }
  const progress = Math.trunc(((frame - previousFrame) * RIDE_CAMERA_PROGRESS_ONE) / (key.frame - previousFrame))
  return Math.min(Math.max(progress, 0), RIDE_CAMERA_PROGRESS_ONE)
}

const findAnchorCar = (cars: readonly TrainCar[], direction: TrainDirection, anchor: number) => {
  const carIndex =
    anchor >= RIDE_CAMERA_ABSOLUTE_ALTITUDE_ANCHOR
      ? anchor - RIDE_CAMERA_ABSOLUTE_ALTITUDE_ANCHOR
      : anchor - RIDE_CAMERA_RELATIVE_ANCHOR
  return cars[direction === 1 ? carIndex : cars.length - carIndex - 1]
}

const resolveAnchor = (
  cars: readonly TrainCar[],
  direction: TrainDirection,
  anchor: number,
  offset: readonly number[],
): PsxVector => {
  const car = findAnchorCar(cars, direction, anchor) ?? cars[0]
  const altitudeOffset = toInt16(offset[1])
  return {
    altitude: anchor >= RIDE_CAMERA_ABSOLUTE_ALTITUDE_ANCHOR ? altitudeOffset : car.altitude + altitudeOffset,
    x: car.x + toInt16(offset[0]),
    z: car.z + toInt16(offset[2]),
  }
}

const resolveKey = (key: RideCameraKey, cars: readonly TrainCar[], direction: TrainDirection): RideCameraView => ({
  eye: resolveAnchor(cars, direction, key.eye_anchor, key.eye),
  target: resolveAnchor(cars, direction, key.target_anchor, key.target),
})

const interpolateScalar = (from: number, to: number, progress: number) =>
  from + Math.trunc((progress * (to - from)) / RIDE_CAMERA_PROGRESS_ONE)

const interpolateVector = (from: PsxVector, to: PsxVector, progress: number): PsxVector => ({
  altitude: interpolateScalar(from.altitude, to.altitude, progress),
  x: interpolateScalar(from.x, to.x, progress),
  z: interpolateScalar(from.z, to.z, progress),
})

const findStationKeyIndex = (track: RideCameraTrack) => {
  const index = track.findIndex(
    (key) => key.frame === RIDE_CAMERA_TRACK_END || key.frame === RIDE_CAMERA_STATION_MARKER,
  )
  return index === -1 ? track.length - 1 : index
}

export const calculateHeldCameraFrame = (track: RideCameraTrack, frame: number) => {
  const keyIndex = findStationKeyIndex(track)
  const nextKey = track[keyIndex + 1]
  return track[keyIndex]?.frame === RIDE_CAMERA_STATION_MARKER && nextKey ? nextKey.frame - 1 : frame
}

export const calculateRideCameraView = (
  track: RideCameraTrack,
  frame: number,
  cars: readonly TrainCar[],
  direction: TrainDirection,
  isHeldAtStation: boolean,
): RideCameraView | undefined => {
  if (track.length === 0 || cars.length === 0) {
    return undefined
  }
  if (isHeldAtStation) {
    return resolveKey(track[findStationKeyIndex(track)], cars, direction)
  }
  const keyIndex = findActiveKeyIndex(track, frame)
  const key = track[keyIndex]
  const view = resolveKey(key, cars, direction)
  const nextKey = track[keyIndex + 1]
  if (key.interpolation !== RIDE_CAMERA_LERP_TO_NEXT || !nextKey) {
    return view
  }
  const nextView = resolveKey(nextKey, cars, direction)
  const progress = calculateKeyProgress(track, keyIndex, frame)
  return {
    eye: interpolateVector(view.eye, nextView.eye, progress),
    target: interpolateVector(view.target, nextView.target, progress),
  }
}
