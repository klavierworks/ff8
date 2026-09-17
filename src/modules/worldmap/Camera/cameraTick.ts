import { WORLDMAP_CAMERA_MODE_DEFAULT } from '../../../constants/worldmapCamera'
import { calculateAutopilotRotateInput } from '../Player/FlyingRagnarok/autopilotUtils'
import { wrapPsxAngle } from '../Player/playerAngles'
import { isRagnarok, isSteeredVehicle, isWalkerClass } from '../vehicleClasses'
import { WORLD_MAP_STATE_AUTOPILOT, WORLD_MAP_STATE_FREE_ROAM } from '../worldmapStore'
import { createInitialFocus, PsxPoint, stepFocus } from './cameraFocus'
import { easeRagnarokPitch, hasTerrainPitchDip, stepTerrainPitch } from './cameraPitch'
import {
  getModeChangeRetarget,
  hasPendingRetarget,
  NO_RETARGET,
  RetargetFlags,
  stepRetarget,
  VEHICLE_CHANGE_RETARGET,
} from './cameraRetarget'
import { calculateRagnarokPitch, CameraRig, createRestingRig, getFogStartTarget } from './cameraRig'
import {
  CameraTransition,
  createCameraTransition,
  finishCameraTransition,
  isCameraTransitionState,
  isTakeoffFocusHeld,
  ShipTransitionInput,
  stepCameraTransition,
} from './cameraTransition'
import { stepFollowVehicleYaw, stepManualVehicleYaw, stepOnFootYaw } from './cameraYaw'

export type CameraMemory = {
  flags: RetargetFlags
  focus: PsxPoint
  followSpeed: number
  holdTicks: number
  lastCameraModeIndex: number
  lastTick: number
  lastVehicleId: number
  lastWorldMapState: number
  manualVelocity: number
  onFootVelocity: number
  rig: CameraRig
  transition: CameraTransition | null
}

export type CameraTickInput = {
  cameraModeIndex: number
  headingPsx: number
  isMoving: boolean
  isNoSteering: boolean
  isOccluded: boolean
  isOnCanopyGround: boolean
  isThrottling: boolean
  isTurning: boolean
  player: PsxPoint
  rotateInput: number
  tick: number
  vehicleId: number
  worldMapState: number
}

type CameraMemoryInit = {
  cameraModeIndex: number
  player: PsxPoint
  tick: number
  vehicleId: number
  worldMapState: number
  yaw: number
}

export const createCameraMemory = ({
  cameraModeIndex,
  player,
  tick,
  vehicleId,
  worldMapState,
  yaw,
}: CameraMemoryInit): CameraMemory => ({
  flags: NO_RETARGET,
  focus: createInitialFocus(player),
  followSpeed: 0,
  holdTicks: 0,
  lastCameraModeIndex: cameraModeIndex,
  lastTick: tick,
  lastVehicleId: vehicleId,
  lastWorldMapState: worldMapState,
  manualVelocity: 0,
  onFootVelocity: 0,
  rig: createRestingRig(vehicleId, cameraModeIndex, player.altitude, yaw),
  transition: null,
})

const getShipTransitionInput = (input: CameraTickInput): ShipTransitionInput => ({
  altitude: input.player.altitude,
  headingPsx: input.headingPsx,
})

const resolveTransition = (memory: CameraMemory, input: CameraTickInput) => {
  const current = memory.transition
  if (current?.kind === input.worldMapState) {
    return { rig: memory.rig, transition: current }
  }
  const rig = current
    ? finishCameraTransition(memory.rig, current, getShipTransitionInput(input), input.cameraModeIndex)
    : memory.rig
  return {
    rig,
    transition: createCameraTransition(input.worldMapState, rig, getShipTransitionInput(input), input.cameraModeIndex),
  }
}

const runTransitionTick = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  const resolved = resolveTransition(memory, input)
  const stepped = stepCameraTransition(
    resolved.rig,
    resolved.transition,
    getShipTransitionInput(input),
    input.cameraModeIndex,
  )
  return { ...memory, rig: stepped.rig, transition: stepped.transition }
}

const closeTransition = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (!memory.transition) {
    return memory
  }
  return {
    ...memory,
    flags: NO_RETARGET,
    rig: finishCameraTransition(memory.rig, memory.transition, getShipTransitionInput(input), input.cameraModeIndex),
    transition: null,
  }
}

const hasVehicleChangedInFreeRoam = (memory: CameraMemory, input: CameraTickInput) =>
  memory.lastWorldMapState === WORLD_MAP_STATE_FREE_ROAM && memory.lastVehicleId !== input.vehicleId

const updateRetargetFlags = (memory: CameraMemory, input: CameraTickInput): RetargetFlags => {
  if (hasVehicleChangedInFreeRoam(memory, input)) {
    return VEHICLE_CHANGE_RETARGET
  }
  if (memory.lastCameraModeIndex !== input.cameraModeIndex) {
    return getModeChangeRetarget(memory.flags, input.vehicleId)
  }
  return memory.flags
}

const applyTerrainPitch = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (!hasTerrainPitchDip(input.vehicleId, input.cameraModeIndex)) {
    return memory
  }
  const step = stepTerrainPitch(memory.rig.pitch, memory.holdTicks, {
    isMoving: input.isMoving,
    isOccluded: input.isOccluded,
    isStandingInCanopy: input.isOnCanopyGround && isWalkerClass(input.vehicleId),
    isThrottling: input.isThrottling,
    isTurning: input.isTurning,
  })
  return { ...memory, holdTicks: step.holdTicks, rig: { ...memory.rig, pitch: step.pitch } }
}

const resolveSteeredRotateInput = (memory: CameraMemory, input: CameraTickInput) =>
  input.worldMapState === WORLD_MAP_STATE_AUTOPILOT
    ? calculateAutopilotRotateInput(input.headingPsx, memory.rig.yaw)
    : input.rotateInput

const applySteeredVehicleYaw = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (input.cameraModeIndex !== WORLDMAP_CAMERA_MODE_DEFAULT) {
    const step = stepManualVehicleYaw(memory.rig.yaw, memory.manualVelocity, resolveSteeredRotateInput(memory, input))
    return { ...memory, manualVelocity: step.velocity, rig: { ...memory.rig, yaw: step.yaw } }
  }
  const step = stepFollowVehicleYaw(memory.rig.yaw, memory.followSpeed, input.headingPsx)
  return { ...memory, followSpeed: step.velocity, rig: { ...memory.rig, yaw: step.yaw } }
}

const applyRagnarokPitchEase = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (!isRagnarok(input.vehicleId) || input.worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
    return memory
  }
  const pitch = easeRagnarokPitch(memory.rig.pitch, calculateRagnarokPitch(input.player.altitude))
  return { ...memory, rig: { ...memory.rig, pitch } }
}

const applyYaw = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (isSteeredVehicle(input.vehicleId)) {
    return applyRagnarokPitchEase(applySteeredVehicleYaw(memory, input), input)
  }
  if (!isWalkerClass(input.vehicleId)) {
    return memory
  }
  const step = stepOnFootYaw(memory.rig.yaw, memory.onFootVelocity, {
    headingPsx: input.headingPsx,
    isNoSteering: input.isNoSteering,
    rotateInput: input.rotateInput,
  })
  return { ...memory, onFootVelocity: step.velocity, rig: { ...memory.rig, yaw: step.yaw } }
}

const applyRetarget = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  const retargeted = stepRetarget(memory.rig, updateRetargetFlags(memory, input), {
    altitude: input.player.altitude,
    cameraModeIndex: input.cameraModeIndex,
    isOccluded: input.isOccluded,
    vehicleId: input.vehicleId,
  })
  return { ...memory, flags: retargeted.flags, rig: retargeted.rig }
}

const applyFogPreset = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  if (hasPendingRetarget(memory.flags)) {
    return memory
  }
  return { ...memory, rig: { ...memory.rig, fogStart: getFogStartTarget(input.vehicleId) } }
}

const runFreeRoamTick = (memory: CameraMemory, input: CameraTickInput): CameraMemory =>
  applyFogPreset(applyRetarget(applyYaw(applyTerrainPitch(closeTransition(memory, input), input), input), input), input)

const finishTick = (memory: CameraMemory, input: CameraTickInput): CameraMemory => ({
  ...memory,
  focus: stepFocus(memory.focus, input.player, isTakeoffFocusHeld(memory.transition)),
  lastCameraModeIndex: input.cameraModeIndex,
  lastTick: input.tick,
  lastVehicleId: input.vehicleId,
  lastWorldMapState: input.worldMapState,
  rig: { ...memory.rig, yaw: wrapPsxAngle(memory.rig.yaw) },
})

export const runCameraTick = (memory: CameraMemory, input: CameraTickInput): CameraMemory => {
  const stepped = isCameraTransitionState(input.worldMapState)
    ? runTransitionTick(memory, input)
    : runFreeRoamTick(memory, input)
  return finishTick(stepped, input)
}
