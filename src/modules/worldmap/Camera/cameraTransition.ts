import { VEHICLE_IDS } from '../../../constants/vehicles'
import {
  WORLDMAP_LANDING_DIVISOR,
  WORLDMAP_RAGNAROK_CEILING_ALTITUDE,
  WORLDMAP_TAKEOFF_SETTLE_DIVISOR,
  WORLDMAP_TAKEOFF_YAW_DIVISOR,
  WORLDMAP_TAKEOFF_YAW_LAST_TICK,
  WORLDMAP_TAKEOFF_ZOOM_DIVISOR,
  WORLDMAP_TRANSITION_LAST_TICK,
} from '../../../constants/worldmapCamera'
import { shortestPsxDelta } from '../Player/playerAngles'
import { WORLD_MAP_STATE_RAGNAROK_LANDING, WORLD_MAP_STATE_RAGNAROK_TAKEOFF } from '../worldmapStore'
import {
  calculateRagnarokPitch,
  CameraRig,
  createRestingRig,
  getCurvatureStartTarget,
  getDepthTarget,
  getFogStartTarget,
  getPitchTarget,
  getZoomTarget,
} from './cameraRig'

export type CameraTransition = {
  kind: number
  steps: CameraRig
  tick: number
}

export type ShipTransitionInput = {
  altitude: number
  headingPsx: number
}

const TAKEOFF_TARGET_VEHICLE = VEHICLE_IDS.RAGNAROK
const LANDING_TARGET_VEHICLE = VEHICLE_IDS.ON_FOOT

const divideTowards = (target: number, current: number, divisor: number) => Math.trunc((target - current) / divisor)

const calculateTakeoffAltitude = (altitude: number) =>
  altitude + Math.floor((WORLDMAP_RAGNAROK_CEILING_ALTITUDE - altitude) / 2)

const createTakeoffSteps = (rig: CameraRig, ship: ShipTransitionInput, cameraModeIndex: number): CameraRig => ({
  curvatureStart: divideTowards(
    getCurvatureStartTarget(TAKEOFF_TARGET_VEHICLE),
    rig.curvatureStart,
    WORLDMAP_TAKEOFF_SETTLE_DIVISOR,
  ),
  depth: divideTowards(getDepthTarget(TAKEOFF_TARGET_VEHICLE), rig.depth, WORLDMAP_TAKEOFF_SETTLE_DIVISOR),
  fogStart: divideTowards(getFogStartTarget(TAKEOFF_TARGET_VEHICLE), rig.fogStart, WORLDMAP_TAKEOFF_SETTLE_DIVISOR),
  pitch: Math.trunc(
    shortestPsxDelta(rig.pitch, calculateRagnarokPitch(calculateTakeoffAltitude(ship.altitude))) /
      WORLDMAP_TAKEOFF_SETTLE_DIVISOR,
  ),
  yaw: Math.trunc(shortestPsxDelta(rig.yaw, ship.headingPsx) / WORLDMAP_TAKEOFF_YAW_DIVISOR),
  zoom: divideTowards(getZoomTarget(TAKEOFF_TARGET_VEHICLE, cameraModeIndex), rig.zoom, WORLDMAP_TAKEOFF_ZOOM_DIVISOR),
})

const createLandingSteps = (rig: CameraRig, ship: ShipTransitionInput, cameraModeIndex: number): CameraRig => ({
  curvatureStart: divideTowards(
    getCurvatureStartTarget(LANDING_TARGET_VEHICLE),
    rig.curvatureStart,
    WORLDMAP_LANDING_DIVISOR,
  ),
  depth: divideTowards(getDepthTarget(LANDING_TARGET_VEHICLE), rig.depth, WORLDMAP_LANDING_DIVISOR),
  fogStart: divideTowards(getFogStartTarget(LANDING_TARGET_VEHICLE), rig.fogStart, WORLDMAP_LANDING_DIVISOR),
  pitch: Math.trunc(
    shortestPsxDelta(rig.pitch, getPitchTarget(LANDING_TARGET_VEHICLE, cameraModeIndex, ship.altitude)) /
      WORLDMAP_LANDING_DIVISOR,
  ),
  yaw: Math.trunc(shortestPsxDelta(rig.yaw, ship.headingPsx) / WORLDMAP_LANDING_DIVISOR),
  zoom: divideTowards(getZoomTarget(LANDING_TARGET_VEHICLE, cameraModeIndex), rig.zoom, WORLDMAP_LANDING_DIVISOR),
})

export const isCameraTransitionState = (worldMapState: number) =>
  worldMapState === WORLD_MAP_STATE_RAGNAROK_TAKEOFF || worldMapState === WORLD_MAP_STATE_RAGNAROK_LANDING

export const createCameraTransition = (
  kind: number,
  rig: CameraRig,
  ship: ShipTransitionInput,
  cameraModeIndex: number,
): CameraTransition => ({
  kind,
  steps:
    kind === WORLD_MAP_STATE_RAGNAROK_TAKEOFF
      ? createTakeoffSteps(rig, ship, cameraModeIndex)
      : createLandingSteps(rig, ship, cameraModeIndex),
  tick: 0,
})

const isCameraTransitionFinished = ({ tick }: CameraTransition) => tick > WORLDMAP_TRANSITION_LAST_TICK

export const isTakeoffFocusHeld = (transition: CameraTransition | null) =>
  transition !== null &&
  transition.kind === WORLD_MAP_STATE_RAGNAROK_TAKEOFF &&
  transition.tick <= WORLDMAP_TAKEOFF_YAW_LAST_TICK + 1

const addSteps = (rig: CameraRig, steps: CameraRig, keys: readonly (keyof CameraRig)[]): CameraRig =>
  keys.reduce((next, key) => ({ ...next, [key]: next[key] + steps[key] }), rig)

const SETTLE_KEYS = ['curvatureStart', 'depth', 'fogStart', 'pitch'] as const
const ALL_KEYS = ['curvatureStart', 'depth', 'fogStart', 'pitch', 'yaw', 'zoom'] as const

const snapToRagnarok = (rig: CameraRig, ship: ShipTransitionInput, cameraModeIndex: number): CameraRig =>
  createRestingRig(TAKEOFF_TARGET_VEHICLE, cameraModeIndex, ship.altitude, rig.yaw)

const stepTakeoffRig = (
  rig: CameraRig,
  transition: CameraTransition,
  ship: ShipTransitionInput,
  cameraModeIndex: number,
) => {
  const isSettling = transition.tick > WORLDMAP_TAKEOFF_YAW_LAST_TICK
  const moved = isSettling
    ? { ...addSteps(rig, transition.steps, SETTLE_KEYS), yaw: ship.headingPsx }
    : addSteps(rig, transition.steps, ['yaw'])
  const zoomed = addSteps(moved, transition.steps, ['zoom'])
  if (transition.tick + 1 > WORLDMAP_TRANSITION_LAST_TICK) {
    return snapToRagnarok(zoomed, ship, cameraModeIndex)
  }
  return zoomed
}

export const stepCameraTransition = (
  rig: CameraRig,
  transition: CameraTransition,
  ship: ShipTransitionInput,
  cameraModeIndex: number,
) => {
  if (isCameraTransitionFinished(transition)) {
    return { rig, transition }
  }
  const nextRig =
    transition.kind === WORLD_MAP_STATE_RAGNAROK_TAKEOFF
      ? stepTakeoffRig(rig, transition, ship, cameraModeIndex)
      : addSteps(rig, transition.steps, ALL_KEYS)
  return { rig: nextRig, transition: { ...transition, tick: transition.tick + 1 } }
}

export const finishCameraTransition = (
  rig: CameraRig,
  transition: CameraTransition,
  ship: ShipTransitionInput,
  cameraModeIndex: number,
): CameraRig => {
  if (isCameraTransitionFinished(transition)) {
    return rig
  }
  const next = stepCameraTransition(rig, transition, ship, cameraModeIndex)
  return finishCameraTransition(next.rig, next.transition, ship, cameraModeIndex)
}
