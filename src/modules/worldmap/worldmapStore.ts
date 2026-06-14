import { create } from 'zustand'

import { VEHICLE_ON_FOOT } from './Player/FlyingRagnarok/flightConstants'

export type WorldmapControlsState = {
  cameraPitch: number
  cameraYaw: number
  isAccelerating: boolean
  isBraking: boolean
  isRunning: boolean
  isWalkingSlow: boolean
  moveX: number
  moveY: number
}

type WorldmapCameraState = {
  yawRadians: number
}

// Drives the vehicle-transition state machine. The active states the port
// currently honours are:
//   free roam = on-foot or in-vehicle, controlled by vehicleId
//   landing   = Ragnarok touchdown transition, ends on-foot
//   take-off  = Ragnarok ascent transition, ends piloting the Ragnarok
// Both transitions run for WORLD_MAP_TRANSITION_FRAMES at the original 30 FPS.
export const WORLD_MAP_STATE_FREE_ROAM = 0
export const WORLD_MAP_STATE_RAGNAROK_LANDING = 5
export const WORLD_MAP_STATE_RAGNAROK_TAKEOFF = 6
export const WORLD_MAP_TRANSITION_FRAMES = 60

// Position of a Ragnarok-landable parking spot, in world coordinates. Sourced
// from the always-available special-location landing zones plus any
// runtime-spawned landable entities (e.g. story-locked locations like the Deep
// Sea Research Center).
export type RagnarokLandingSpot = {
  worldX: number
  worldY: number
  worldZ: number
}

type WorldmapState = {
  camera: WorldmapCameraState
  cameraModeIndex: number
  controls: WorldmapControlsState
  entityDistances: Record<number, number>
  entryMode: number
  // Landing spots populated once at worldmap mount from the loaded sections.
  // The Ragnarok landing-toggle reads this list to decide whether the current
  // position is over a valid parking zone.
  landingSpots: readonly RagnarokLandingSpot[]
  // When a landing is in progress, the snap-target the animator interpolates
  // toward. Null when state != WORLD_MAP_STATE_RAGNAROK_LANDING.
  landingTarget: null | RagnarokLandingSpot
  minimapMode: number
  // Where the Ragnarok is parked when we're not piloting it. Renders as a
  // visible airship on the worldmap (mirrors the original game's behaviour:
  // dismounting leaves the ship visibly at the landing spot).
  parkedRagnarokPosition: null | RagnarokLandingSpot
  // Captured ship heading (PSX angle units, 0..4095) at landing-complete so the
  // parked airship keeps its touchdown facing while the dismounted pilot turns
  // freely on foot. Null while no parked ship exists.
  parkedRagnarokYawPsx: null | number
  preTransitionVehicleId: number
  // Altitude-input camera tilt accumulator (PSX angle units, clamped to ±4096).
  // Integrated each frame from the altitude axis and drives the Ragnarok camera
  // pitch target.
  ragnarokCameraTiltPsx: number
  skyLightColor1: [number, number, number]
  skyLightColor2: [number, number, number]
  spawnPointId: number
  // Vehicle that will be active after the current transition completes — and
  // is the active vehicle whenever `worldMapState == 0`.
  vehicleId: number
  worldMapState: number
  worldMapStateProgress: number
}

const INITIAL_STATE: WorldmapState = {
  camera: { yawRadians: 0 },
  cameraModeIndex: 0,
  controls: {
    cameraPitch: 0,
    cameraYaw: 0,
    isAccelerating: false,
    isBraking: false,
    isRunning: false,
    isWalkingSlow: false,
    moveX: 0,
    moveY: 0,
  },
  entityDistances: {},
  entryMode: 0,
  landingSpots: [],
  landingTarget: null,
  minimapMode: 0,
  parkedRagnarokPosition: null,
  parkedRagnarokYawPsx: null,
  preTransitionVehicleId: VEHICLE_ON_FOOT,
  ragnarokCameraTiltPsx: 0,
  skyLightColor1: [64, 64, 64],
  skyLightColor2: [128, 128, 128],
  spawnPointId: 0,
  vehicleId: VEHICLE_ON_FOOT,
  worldMapState: WORLD_MAP_STATE_FREE_ROAM,
  worldMapStateProgress: 0,
}

const useWorldmapStore = create<WorldmapState>()(() => ({ ...INITIAL_STATE }))

export default useWorldmapStore
