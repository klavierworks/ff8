import { useFrame } from '@react-three/fiber'
import { useCallback, useRef } from 'react'

import { FIELD_REVEAL_TOGGLE_KEY } from '../../../constants/fieldReveal'
import useFieldRevealStore, { beginFieldIntro, enterFieldRevealStage } from '../fieldRevealStore'
import { getToggledStage } from '../fieldRevealUtils'
import {
  accumulateFadeSettledSeconds,
  advanceFieldReveal,
  getIsIntroFadeSettled,
  rewindFieldReveal,
} from './fieldRevealSteps'
import useToggleKey from './useToggleKey'

const FieldReveal = () => {
  const handleToggle = useCallback(() => {
    enterFieldRevealStage(getToggledStage(useFieldRevealStore.getState().stage))
  }, [])
  useToggleKey(FIELD_REVEAL_TOGGLE_KEY, handleToggle)

  const fadeSettledSecondsRef = useRef(0)

  useFrame((_, delta) => {
    const { direction, isIntroRequested } = useFieldRevealStore.getState()
    if (isIntroRequested) {
      fadeSettledSecondsRef.current = accumulateFadeSettledSeconds(fadeSettledSecondsRef.current, delta)
      if (getIsIntroFadeSettled(fadeSettledSecondsRef.current)) {
        fadeSettledSecondsRef.current = 0
        beginFieldIntro()
      }
      return
    }
    if (direction === 'reverse') {
      rewindFieldReveal(delta)
      return
    }
    advanceFieldReveal(delta)
  })

  return null
}

export default FieldReveal
