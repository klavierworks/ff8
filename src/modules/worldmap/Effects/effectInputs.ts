import { Scene, Vector3 } from 'three'

import { FORCE_FIELD_ENTITY_TYPE } from '../../../constants/worldmapEntities'
import { BOAT_RIDE_RIDDEN_CAR_INDEX } from '../../../constants/worldmapTrains'
import { PSX_ANGLE_TO_RAD, WORLDMAP_SCALE } from '../constants'
import { convertEntityXToMapX, convertEntityYToMapZ, worldXToPsx, worldZToPsx } from '../Player/playerUtils'
import { getEntity } from '../Scripts/state'
import { queryTerrain, selectTopTriangle } from '../terrain'
import { TrainSession } from '../Trains/trainSession'
import { PsxVector } from './effectPool'
import { EffectPose, toSignedWord } from './emitterUtils'

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
const BOAT_WAKE_TRAIN_SLOT = 0
const CAR_YAW_OFFSET = 2048
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

const calculateGameAngle = (dx: number, dy: number) => toSignedWord(Math.round(Math.atan2(dx, dy) / PSX_ANGLE_TO_RAD))

// Rail z runs opposite to the port's z axis, so the car's yaw is negated; its pitch is unaffected.
export const getBoatWakePose = (session: null | TrainSession): EffectPose | undefined => {
  const train = session?.trains[BOAT_WAKE_TRAIN_SLOT]
  const car = train?.cars[BOAT_RIDE_RIDDEN_CAR_INDEX]
  const link = train?.links[BOAT_RIDE_RIDDEN_CAR_INDEX] ?? 0
  const neighbour = train?.cars[BOAT_RIDE_RIDDEN_CAR_INDEX + link]
  if (!car || !neighbour || link === 0) {
    return undefined
  }
  const dx = toSignedWord(neighbour.x - car.x)
  const dAltitude = toSignedWord(neighbour.altitude - car.altitude)
  const dz = toSignedWord(neighbour.z - car.z)
  const yaw = calculateGameAngle(-dz, dx) + CAR_YAW_OFFSET
  const pitch = calculateGameAngle(-dAltitude, Math.trunc(Math.hypot(dx, dz)))
  return {
    position: { x: convertEntityXToMapX(car.x), y: car.altitude, z: convertEntityYToMapZ(-car.z) },
    rotation: { x: 0, y: -yaw, z: pitch },
  }
}

// Entity positions store the port's z, which runs opposite to the engine's, so the bearing is
// taken against the negated z delta and then negated like the boat's yaw.
export const getForceFieldFlashYaw = (candidate: number, previousCandidate: number, playerPosition: Vector3) => {
  const entity = getEntity(candidate)
  if (candidate === previousCandidate || entity?.typeCode !== FORCE_FIELD_ENTITY_TYPE) {
    return undefined
  }
  const dx = toSignedWord(entity.positionX - worldXToPsx(playerPosition.x))
  const dz = toSignedWord(entity.positionY - worldZToPsx(playerPosition.z))
  return -calculateGameAngle(dx, -dz)
}
