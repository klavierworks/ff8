import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect } from 'react'

import { FIELD_REVEAL_STAGE_FRAMES, FIELD_REVEAL_TOGGLE_KEY } from '../../../constants/fieldReveal'
import { advanceProgress } from '../../../timing'
import useFieldRevealStore, { enterFieldRevealStage, setIsAutoReveal } from '../fieldRevealStore'
import { getNextStage, getToggledStage } from '../fieldRevealUtils'
import useToggleKey from './useToggleKey'

const FieldReveal = () => {
  useEffect(() => {
    if (!useFieldRevealStore.getState().isAutoReveal) {
      enterFieldRevealStage('hidden')
    }
  }, [])

  const handleToggle = useCallback(() => {
    setIsAutoReveal(false)
    enterFieldRevealStage(getToggledStage(useFieldRevealStore.getState().stage))
  }, [])
  useToggleKey(FIELD_REVEAL_TOGGLE_KEY, handleToggle)

  useFrame((_, delta) => {
    const { isAutoReveal, stage, stageProgress } = useFieldRevealStore.getState()
    if (isAutoReveal || stage === 'hidden' || stageProgress.value >= 1) {
      return
    }
    stageProgress.value = advanceProgress(stageProgress.value, delta, FIELD_REVEAL_STAGE_FRAMES[stage])
    if (stageProgress.value < 1) {
      return
    }
    if (stage === 'revealed') {
      setIsAutoReveal(true)
      return
    }
    enterFieldRevealStage(getNextStage(stage))
  })

  return null
}

export default FieldReveal
