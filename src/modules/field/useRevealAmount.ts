import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'

import { FIELD_AUTO_REVEAL_SPEED } from '../../constants/fieldReveal'
import { getDelayedProgress } from '../../timing'
import useFieldRevealStore, { FieldRevealStage } from './fieldRevealStore'
import { createProgressUniform, getStageAmount } from './fieldRevealUtils'

type RevealTiming = {
  delayFrames?: number
  durationFrames: number
}

const useRevealAmount = (target: FieldRevealStage, { delayFrames = 0, durationFrames }: RevealTiming) => {
  const [amount] = useState(createProgressUniform)
  const [isMountedInAutoReveal] = useState(() => useFieldRevealStore.getState().isAutoReveal)
  const autoRevealSeconds = useRef(0)

  useFrame((_, delta) => {
    const { isAutoReveal, stage, stageProgress } = useFieldRevealStore.getState()
    if (!isMountedInAutoReveal || !isAutoReveal) {
      amount.value = getStageAmount(stage, stageProgress.value, target)
      return
    }
    autoRevealSeconds.current += delta * FIELD_AUTO_REVEAL_SPEED
    amount.value = getDelayedProgress(autoRevealSeconds.current, delayFrames, durationFrames)
  })

  return amount
}

export default useRevealAmount
