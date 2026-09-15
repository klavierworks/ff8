import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'

import { getScriptFrame } from '../modules/field/scriptClock'
import { useBattleTransitionStore } from './BattleTransitionController'
import { BattleTransitionEffectImpl } from './BattleTransitionEffect'
import { getBattleTransitionPhase } from './battleTransitionUtils'

const BattleTransition = () => {
  const startFrame = useBattleTransitionStore((state) => state.startFrame)
  const variant = useBattleTransitionStore((state) => state.variant)

  const [effect] = useState(() => new BattleTransitionEffectImpl())

  useEffect(() => {
    if (startFrame === undefined) {
      return
    }
    effect.captureScene()

    return () => {
      effect.setIdle()
    }
  }, [effect, startFrame])

  useFrame(() => {
    if (startFrame === undefined || variant === undefined) {
      return
    }
    effect.setPhase(getBattleTransitionPhase(getScriptFrame() - startFrame, variant), variant)
  })

  return <primitive dispose={null} object={effect} />
}

export default BattleTransition
