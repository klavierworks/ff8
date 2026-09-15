import { create } from 'zustand'

import { BOSS_BATTLE_TRANSITION_SOUNDS, NORMAL_BATTLE_TRANSITION_SOUNDS } from '../constants/battle'
import { getScriptFrame, waitForScriptFrames } from '../modules/field/scriptClock'
import useGlobalStore from '../store'
import {
  BattleTransitionVariant,
  getBattleTransitionDuration,
  getBattleTransitionVariant,
} from './battleTransitionUtils'

type BattleTransitionSession = {
  startFrame: number | undefined
  variant: BattleTransitionVariant | undefined
}

const playTransitionSounds = (variant: BattleTransitionVariant) => {
  const { systemSfxController } = useGlobalStore.getState()
  const soundIds = variant === 'boss' ? BOSS_BATTLE_TRANSITION_SOUNDS : NORMAL_BATTLE_TRANSITION_SOUNDS

  soundIds.forEach((soundId) => systemSfxController.play(soundId, 0, 127, 128))
}

const createBattleTransitionController = () => {
  const store = create<BattleTransitionSession>(() => ({ startFrame: undefined, variant: undefined }))
  const { setState } = store

  const play = async (encounterId: number) => {
    const variant = getBattleTransitionVariant(encounterId)
    const { isUserControllable } = useGlobalStore.getState()

    useGlobalStore.setState({ isUserControllable: false })
    setState({ startFrame: getScriptFrame(), variant })
    playTransitionSounds(variant)

    await waitForScriptFrames(getBattleTransitionDuration(variant))

    setState({ startFrame: undefined, variant: undefined })
    useGlobalStore.setState({ isUserControllable })
  }

  return { play, store }
}

export const battleTransitionController = createBattleTransitionController()

export const useBattleTransitionStore = battleTransitionController.store
