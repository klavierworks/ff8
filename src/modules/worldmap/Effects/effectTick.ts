import { Scene, Vector3 } from 'three'

import { WORLDMAP_STATE } from '../Scripts/state'
import { getTrainSession } from '../Trains/trainSession'
import { isOnFootClass } from '../vehicleClasses'
import { emitWorldmapEffects, FootLatches } from './effectEmitters'
import {
  advancePlayerMotion,
  getBoatWakePose,
  getForceFieldFlashYaw,
  getRunFrameUnits,
  PlayerMotion,
  probeGround,
  threeToPsx,
} from './effectInputs'
import { EffectDefinition, LiveEffect, PsxVector, RandomByte, spawnEffect, stepEffectPool } from './effectPool'
import { EmitterInput } from './emitterUtils'

export type EffectFrameInput = {
  characterPosition: undefined | Vector3
  fieldDirection: number
  scene: Scene
  vehicleId: number
  worldMapState: number
}

export type EffectTickState = {
  footLatches: FootLatches
  motion: PlayerMotion
  previousCandidate: number
}

// The port turns the player by +fieldDirection about Y; the engine's Y rotation turns the other way.
const getPsxYaw = (fieldDirection: number) => -fieldDirection

export const runEffectTick = (
  pool: LiveEffect[],
  definitions: readonly EffectDefinition[],
  state: EffectTickState,
  frame: EffectFrameInput,
  random: RandomByte,
): EffectTickState => {
  const { characterPosition, fieldDirection, scene, vehicleId, worldMapState } = frame
  if (!characterPosition) {
    return state
  }

  const position = threeToPsx(characterPosition)
  const motion = advancePlayerMotion(state.motion, position)
  const isOnFoot = isOnFootClass(vehicleId)
  const candidate = WORLDMAP_STATE.tightCandidate
  const input: EmitterInput = {
    ...probeGround(scene, characterPosition.x, characterPosition.z),
    boatWakePose: getBoatWakePose(getTrainSession()),
    forceFieldFlashYaw: isOnFoot
      ? getForceFieldFlashYaw(candidate, state.previousCandidate, characterPosition)
      : undefined,
    position,
    runFrameUnits: getRunFrameUnits(motion),
    speed: motion.speed,
    vehicleId,
    worldMapState,
    yaw: getPsxYaw(fieldDirection),
  }
  const spawn = (effectId: number, spawnPosition: PsxVector, rotation: PsxVector, flags: number) =>
    spawnEffect(pool, definitions[effectId], spawnPosition, rotation, flags, random)

  const footLatches = emitWorldmapEffects(spawn, input, state.footLatches, random)
  stepEffectPool(pool, definitions, motion.delta)
  return { footLatches, motion, previousCandidate: isOnFoot ? candidate : state.previousCandidate }
}
