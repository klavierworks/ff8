import { invalidate, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { RENDER_ORDER, SPINNER_SCALE } from '../../../../constants/cardGameLayout'
import { MS_PER_FRAME } from '../../../../timing'
import { createSpinnerGeometry } from '../Spinner/spinnerGeometry'

type TurnCursorProps = {
  x: number
  y: number
}

const BOB_FRAMES = 30
const BOB_AMPLITUDE = 1.5
const SPIN_FRAMES = 90

const TurnCursor = ({ x, y }: TurnCursorProps) => {
  const groupRef = useRef<Group>(null)
  const accumulatedRef = useRef(0)
  const geometry = useMemo(() => createSpinnerGeometry(SPINNER_SCALE), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }
    accumulatedRef.current += delta * 1000
    const frame = accumulatedRef.current / MS_PER_FRAME
    const bobPhase = ((frame % BOB_FRAMES) / BOB_FRAMES) * Math.PI * 2
    const bobY = BOB_AMPLITUDE * Math.sin(bobPhase)
    group.position.set(x, -(y + bobY), 0)
    group.rotation.set(0, ((frame % SPIN_FRAMES) / SPIN_FRAMES) * Math.PI * 2, 0)
    invalidate()
  })

  return (
    <group position={[x, -y, 0]} ref={groupRef}>
      <mesh geometry={geometry} renderOrder={RENDER_ORDER.cursor}>
        <meshBasicMaterial depthTest={false} depthWrite={false} vertexColors />
      </mesh>
    </group>
  )
}

export default TurnCursor
