import { invalidate, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { RENDER_ORDER, SPINNER_REST_X, SPINNER_REST_Y, SPINNER_SCALE } from '../../../../constants/cardGameLayout'
import { MS_PER_FRAME } from '../../../../timing'
import { CardOwner } from '../../types'
import { calculateSpinnerPose } from './spinnerAnimation'
import { createSpinnerGeometry } from './spinnerGeometry'

type SpinnerProps = {
  onComplete?: () => void
  winner: CardOwner
}

const Spinner = ({ onComplete, winner }: SpinnerProps) => {
  const groupRef = useRef<Group>(null)
  const elapsedRef = useRef(0)
  const hasCompletedRef = useRef(false)
  const geometry = useMemo(() => createSpinnerGeometry(SPINNER_SCALE), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }

    elapsedRef.current += delta * 1000
    const frame = elapsedRef.current / MS_PER_FRAME
    const pose = calculateSpinnerPose(frame, winner)

    group.position.set(SPINNER_REST_X, -(SPINNER_REST_Y + pose.offsetY), 0)
    group.rotation.set(pose.rotationX, pose.rotationY, 0)

    if (pose.isTossDone && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete?.()
    }

    invalidate()
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} renderOrder={RENDER_ORDER.cursor}>
        <meshBasicMaterial depthTest={false} depthWrite={false} vertexColors />
      </mesh>
    </group>
  )
}

export default Spinner
