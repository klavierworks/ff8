import { Scene, Vector3 } from 'three'

import { WORLDMAP_SCALE } from '../constants'
import { queryTerrain, selectTopTriangle } from '../terrain'
import { PsxVector } from './effectPool'

export type GroundProbe = {
  groundType: number | undefined
  groundY: number | undefined
}

export type PlayerMotion = {
  delta: PsxVector
  position: PsxVector | undefined
  runFrames: number
  speed: number
}

const RUN_CYCLE_FRAMES = 20
const FRAME_UNITS_PER_KEYFRAME = 16
const TELEPORT_DISTANCE = 4096

export const createPlayerMotion = (): PlayerMotion => ({
  delta: { x: 0, y: 0, z: 0 },
  position: undefined,
  runFrames: 0,
  speed: 0,
})

export const threeToPsx = (position: Vector3): PsxVector => ({
  x: Math.trunc(position.x / WORLDMAP_SCALE),
  y: Math.trunc(-position.y / WORLDMAP_SCALE),
  z: Math.trunc(position.z / WORLDMAP_SCALE),
})

export const probeGround = (scene: Scene, x: number, z: number): GroundProbe => {
  const triangle = selectTopTriangle(queryTerrain(scene, x, z))
  return {
    groundType: triangle?.groundType,
    groundY: triangle ? Math.trunc(triangle.psxY) : undefined,
  }
}

const getFrameDelta = (previous: PsxVector, position: PsxVector): PsxVector => {
  const delta = { x: position.x - previous.x, y: position.y - previous.y, z: position.z - previous.z }
  const isTeleport = Math.hypot(delta.x, delta.z) > TELEPORT_DISTANCE
  return isTeleport ? { x: 0, y: 0, z: 0 } : delta
}

export const advancePlayerMotion = (motion: PlayerMotion, position: PsxVector): PlayerMotion => {
  const delta = getFrameDelta(motion.position ?? position, position)
  const speed = Math.trunc(Math.hypot(delta.x, delta.z))
  return {
    ...motion,
    delta,
    position,
    runFrames: speed > 0 ? motion.runFrames + 1 : 0,
    speed,
  }
}

export const getRunFrameUnits = (motion: PlayerMotion) =>
  motion.speed > 0 ? ((motion.runFrames - 1) % RUN_CYCLE_FRAMES) * FRAME_UNITS_PER_KEYFRAME : undefined
