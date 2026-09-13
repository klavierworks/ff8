import { useFrame } from '@react-three/fiber'
import { useState } from 'react'

import LerpValue, { cosineEaseInOut } from '../../../LerpValue'
import useGlobalStore from '../../../store'

const startNextSwing = (axis: LerpValue, amplitude: number, duration: number) => {
  const magnitude = Math.random() * amplitude

  axis.start(axis.get() > 0 ? -magnitude : magnitude, axis.calculateDuration(duration))
}

const updateAxis = (axis: LerpValue, isActive: boolean, amplitude: number, duration: number) => {
  if (axis.isAnimating) {
    return
  }

  if (isActive) {
    startNextSwing(axis, amplitude, duration)
    return
  }

  if (axis.get() !== 0) {
    axis.start(0, axis.calculateDuration(duration))
  }
}

const useScreenShake = () => {
  const [axes] = useState({
    x: new LerpValue(0, 1, cosineEaseInOut),
    y: new LerpValue(0, 1, cosineEaseInOut),
  })

  const { isActive, xAmplitude, xDuration, yAmplitude, yDuration } = useGlobalStore((state) => state.cameraShake)

  useFrame(() => {
    updateAxis(axes.x, isActive, xAmplitude, xDuration)
    updateAxis(axes.y, isActive, yAmplitude, yDuration)
  })

  return axes
}

export default useScreenShake
