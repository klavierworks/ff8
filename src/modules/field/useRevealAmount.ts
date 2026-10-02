import { useFrame } from '@react-three/fiber'
import { useState } from 'react'

import useFieldRevealStore, { FieldRevealStage } from './fieldRevealStore'
import { createProgressUniform, getStageAmount } from './fieldRevealUtils'

const useRevealAmount = (target: FieldRevealStage) => {
  const [amount] = useState(createProgressUniform)

  useFrame(() => {
    const { stage, stageProgress } = useFieldRevealStore.getState()
    amount.value = getStageAmount(stage, stageProgress.value, target)
  })

  return amount
}

export default useRevealAmount
