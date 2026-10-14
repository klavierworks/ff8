import { useEffect, useRef } from 'react'

import useFieldRevealStore from '../modules/field/fieldRevealStore'
import useGlobalStore from '../store'
import { calculateRevealOpacity } from './controllerUtils'

const getCurrentRevealOpacity = () => {
  if (useGlobalStore.getState().module !== 'field') {
    return 1
  }
  const { stage, stageProgress } = useFieldRevealStore.getState()
  return calculateRevealOpacity(stage, stageProgress.value)
}

const applyRevealOpacity = (element: HTMLElement, opacity: number) => {
  element.style.setProperty('--reveal-opacity', String(opacity))
  element.style.pointerEvents = opacity > 0 ? '' : 'none'
}

const useRevealOpacity = <T extends HTMLElement>(isEnabled: boolean) => {
  const elementRef = useRef<T>(null)

  useEffect(() => {
    if (!isEnabled) {
      return
    }
    let frameId = 0
    let appliedOpacity = -1
    const updateOpacity = () => {
      const opacity = getCurrentRevealOpacity()
      if (elementRef.current && opacity !== appliedOpacity) {
        applyRevealOpacity(elementRef.current, opacity)
        appliedOpacity = opacity
      }
      frameId = requestAnimationFrame(updateOpacity)
    }
    frameId = requestAnimationFrame(updateOpacity)

    return () => cancelAnimationFrame(frameId)
  }, [isEnabled])

  return elementRef
}

export default useRevealOpacity
