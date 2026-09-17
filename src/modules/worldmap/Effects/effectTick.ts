import { Scene, Vector3 } from 'three'

import { EmitterInput, emitWorldmapEffects, FootLatches } from './effectEmitters'
import { advancePlayerMotion, getRunFrameUnits, PlayerMotion, probeGround, threeToPsx } from './effectInputs'
import { EffectDefinition, LiveEffect, PsxVector, RandomByte, spawnEffect, stepEffectPool } from './effectPool'

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
  const input: EmitterInput = {
    ...probeGround(scene, characterPosition.x, characterPosition.z),
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
  return { footLatches, motion }
}
