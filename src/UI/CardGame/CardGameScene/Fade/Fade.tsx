import { invalidate, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MeshBasicMaterial } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../constants/constants'
import { MS_PER_FRAME } from '../../../../timing'

type FadeProps = {
  isFadingOut?: boolean
  onFadedOut?: () => void
}

const FADE_FRAMES = 15
const FADE_DURATION_MS = FADE_FRAMES * MS_PER_FRAME

const Fade = ({ isFadingOut = false, onFadedOut }: FadeProps) => {
  const materialRef = useRef<MeshBasicMaterial>(null)
  const accumulatedRef = useRef(0)
  const isFadeInDoneRef = useRef(false)
  const isFadeOutDoneRef = useRef(false)
  const isFadingOutRef = useRef(isFadingOut)

  useEffect(() => {
    isFadingOutRef.current = isFadingOut
    if (isFadingOut) {
      accumulatedRef.current = 0
      isFadeOutDoneRef.current = false
      invalidate()
    }
  }, [isFadingOut])

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material) {
      return
    }

    if (isFadingOutRef.current) {
      if (isFadeOutDoneRef.current) {
        return
      }
      accumulatedRef.current += delta * 1000
      const progress = Math.min(accumulatedRef.current / FADE_DURATION_MS, 1)
      material.opacity = progress
      invalidate()
      if (progress >= 1) {
        isFadeOutDoneRef.current = true
        onFadedOut?.()
      }
      return
    }

    if (isFadeInDoneRef.current) {
      return
    }
    accumulatedRef.current += delta * 1000
    const progress = Math.min(accumulatedRef.current / FADE_DURATION_MS, 1)
    material.opacity = 1 - progress
    invalidate()
    if (progress >= 1) {
      isFadeInDoneRef.current = true
    }
  })

  return (
    <mesh position={[SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, 0]} renderOrder={-100}>
      <planeGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT]} />
      <meshBasicMaterial color="black" depthTest={false} depthWrite={false} opacity={1} ref={materialRef} transparent />
    </mesh>
  )
}

export default Fade
