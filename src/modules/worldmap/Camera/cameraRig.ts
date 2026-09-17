import { MathUtils } from 'three'

import {
  WORLDMAP_CAMERA_DEPTH_DEFAULT,
  WORLDMAP_CAMERA_DEPTH_RAGNAROK,
  WORLDMAP_CAMERA_MODE_CLOSE,
  WORLDMAP_CURVATURE_START_DEFAULT,
  WORLDMAP_CURVATURE_START_RAGNAROK,
  WORLDMAP_PITCH_DEFAULT,
  WORLDMAP_PITCH_OVERHEAD,
  WORLDMAP_PITCH_RAGNAROK_ALTITUDE_DIVISOR,
  WORLDMAP_PITCH_RAGNAROK_BASE,
  WORLDMAP_ZOOM_CLOSE,
  WORLDMAP_ZOOM_DEFAULT,
} from '../../../constants/worldmapCamera'
import { isBoatClass, isCarOrGarden, isRagnarok, isTrainClass } from '../vehicleClasses'

export type CameraRig = {
  curvatureStart: number
  depth: number
  pitch: number
  yaw: number
  zoom: number
}

const hasFixedFraming = (vehicleId: number) =>
  isCarOrGarden(vehicleId) || isTrainClass(vehicleId) || isBoatClass(vehicleId)

export const calculateRagnarokPitch = (altitude: number) =>
  WORLDMAP_PITCH_RAGNAROK_BASE - Math.trunc(altitude / WORLDMAP_PITCH_RAGNAROK_ALTITUDE_DIVISOR)

export const getZoomTarget = (vehicleId: number, cameraModeIndex: number) => {
  if (hasFixedFraming(vehicleId) || isRagnarok(vehicleId)) {
    return WORLDMAP_ZOOM_DEFAULT
  }
  return cameraModeIndex === WORLDMAP_CAMERA_MODE_CLOSE ? WORLDMAP_ZOOM_CLOSE : WORLDMAP_ZOOM_DEFAULT
}

export const getPitchTarget = (vehicleId: number, cameraModeIndex: number, altitude: number) => {
  if (hasFixedFraming(vehicleId)) {
    return WORLDMAP_PITCH_DEFAULT
  }
  if (isRagnarok(vehicleId)) {
    return calculateRagnarokPitch(altitude)
  }
  return cameraModeIndex === WORLDMAP_CAMERA_MODE_CLOSE ? WORLDMAP_PITCH_OVERHEAD : WORLDMAP_PITCH_DEFAULT
}

export const getDepthTarget = (vehicleId: number) =>
  isRagnarok(vehicleId) ? WORLDMAP_CAMERA_DEPTH_RAGNAROK : WORLDMAP_CAMERA_DEPTH_DEFAULT

export const getCurvatureStartTarget = (vehicleId: number) =>
  isRagnarok(vehicleId) ? WORLDMAP_CURVATURE_START_RAGNAROK : WORLDMAP_CURVATURE_START_DEFAULT

export const createRestingRig = (vehicleId: number, cameraModeIndex: number, altitude: number, yaw: number) => ({
  curvatureStart: getCurvatureStartTarget(vehicleId),
  depth: getDepthTarget(vehicleId),
  pitch: getPitchTarget(vehicleId, cameraModeIndex, altitude),
  yaw,
  zoom: getZoomTarget(vehicleId, cameraModeIndex),
})

export const stepTowards = (value: number, target: number, maxStep: number) =>
  MathUtils.clamp(target, value - maxStep, value + maxStep)
