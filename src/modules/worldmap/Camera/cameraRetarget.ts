import {
  WORLDMAP_CAMERA_DEPTH_RETARGET_STEP,
  WORLDMAP_CAMERA_MODE_DEFAULT,
  WORLDMAP_CURVATURE_START_RETARGET_STEP,
  WORLDMAP_PITCH_RETARGET_STEP,
  WORLDMAP_ZOOM_RETARGET_STEP,
} from '../../../constants/worldmapCamera'
import { isOnFootClass, isWalkerClass } from '../vehicleClasses'
import {
  CameraRig,
  getCurvatureStartTarget,
  getDepthTarget,
  getPitchTarget,
  getZoomTarget,
  stepTowards,
} from './cameraRig'

export type RetargetFlags = {
  isCurvatureStartPending: boolean
  isDepthPending: boolean
  isPitchPending: boolean
  isZoomPending: boolean
}

type RetargetContext = {
  altitude: number
  cameraModeIndex: number
  isOccluded: boolean
  vehicleId: number
}

type SteppedValue = {
  isPending: boolean
  value: number
}

export const NO_RETARGET: RetargetFlags = {
  isCurvatureStartPending: false,
  isDepthPending: false,
  isPitchPending: false,
  isZoomPending: false,
}

export const VEHICLE_CHANGE_RETARGET: RetargetFlags = {
  isCurvatureStartPending: true,
  isDepthPending: true,
  isPitchPending: true,
  isZoomPending: true,
}

export const getModeChangeRetarget = (flags: RetargetFlags, vehicleId: number): RetargetFlags =>
  isWalkerClass(vehicleId) ? { ...flags, isPitchPending: true, isZoomPending: true } : flags

const stepPendingValue = (isPending: boolean, value: number, target: number, maxStep: number): SteppedValue => {
  if (!isPending) {
    return { isPending, value }
  }
  return { isPending: Math.abs(value - target) > maxStep, value: stepTowards(value, target, maxStep) }
}

const isPitchRetargetCancelled = ({ cameraModeIndex, isOccluded, vehicleId }: RetargetContext) =>
  isOnFootClass(vehicleId) && cameraModeIndex === WORLDMAP_CAMERA_MODE_DEFAULT && isOccluded

export const stepRetarget = (rig: CameraRig, flags: RetargetFlags, context: RetargetContext) => {
  const { altitude, cameraModeIndex, vehicleId } = context
  const zoom = stepPendingValue(
    flags.isZoomPending,
    rig.zoom,
    getZoomTarget(vehicleId, cameraModeIndex),
    WORLDMAP_ZOOM_RETARGET_STEP,
  )
  const curvatureStart = stepPendingValue(
    flags.isCurvatureStartPending,
    rig.curvatureStart,
    getCurvatureStartTarget(vehicleId),
    WORLDMAP_CURVATURE_START_RETARGET_STEP,
  )
  const pitch = stepPendingValue(
    flags.isPitchPending,
    rig.pitch,
    getPitchTarget(vehicleId, cameraModeIndex, altitude),
    WORLDMAP_PITCH_RETARGET_STEP,
  )
  const depth = stepPendingValue(
    flags.isDepthPending,
    rig.depth,
    getDepthTarget(vehicleId),
    WORLDMAP_CAMERA_DEPTH_RETARGET_STEP,
  )
  return {
    flags: {
      isCurvatureStartPending: curvatureStart.isPending,
      isDepthPending: depth.isPending,
      isPitchPending: pitch.isPending && !isPitchRetargetCancelled(context),
      isZoomPending: zoom.isPending,
    },
    rig: { ...rig, curvatureStart: curvatureStart.value, depth: depth.value, pitch: pitch.value, zoom: zoom.value },
  }
}
