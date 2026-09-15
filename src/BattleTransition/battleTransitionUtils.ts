import { MathUtils } from 'three'

import {
  BATTLE_TRANSITION_BLACKOUT_FRAMES,
  BATTLE_TRANSITION_RETURN_FRAMES,
  BATTLE_TRANSITION_SETTLE_FRAMES,
  BOSS_BATTLE_TRANSITION_FRAMES,
  BOSS_TRANSITION_ENCOUNTERS,
  NORMAL_BATTLE_TRANSITION_FRAMES,
} from '../constants/battle'

export type BattleTransitionVariant = 'boss' | 'normal'

export const getBattleTransitionVariant = (encounterId: number): BattleTransitionVariant =>
  BOSS_TRANSITION_ENCOUNTERS.has(encounterId) ? 'boss' : 'normal'

const getTransitionFrames = (variant: BattleTransitionVariant) =>
  variant === 'boss' ? BOSS_BATTLE_TRANSITION_FRAMES : NORMAL_BATTLE_TRANSITION_FRAMES

export const getBattleTransitionDuration = (variant: BattleTransitionVariant) =>
  getTransitionFrames(variant) +
  BATTLE_TRANSITION_SETTLE_FRAMES +
  BATTLE_TRANSITION_BLACKOUT_FRAMES +
  BATTLE_TRANSITION_RETURN_FRAMES

export const getBattleTransitionPhase = (elapsedFrames: number, variant: BattleTransitionVariant) => {
  const transitionFrames = getTransitionFrames(variant)
  const settleFrames = elapsedFrames - transitionFrames
  const returnFrames = settleFrames - BATTLE_TRANSITION_SETTLE_FRAMES - BATTLE_TRANSITION_BLACKOUT_FRAMES

  return {
    frame: Math.min(elapsedFrames, transitionFrames),
    sceneOpacity: MathUtils.clamp(returnFrames / BATTLE_TRANSITION_RETURN_FRAMES, 0, 1),
    transitionOpacity: 1 - MathUtils.clamp(settleFrames / BATTLE_TRANSITION_SETTLE_FRAMES, 0, 1),
  }
}
