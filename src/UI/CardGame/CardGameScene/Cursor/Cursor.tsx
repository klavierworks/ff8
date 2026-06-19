import { invalidate, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'

import { RENDER_ORDER } from '../../../../constants/cardGameLayout'

type CursorProps = {
  centerX: number
  centerY: number
  color?: string
  size?: number
}

const THICKNESS = 3

const Cursor = ({ centerX, centerY, color = '#ffffff', size = 64 }: CursorProps) => {
  const groupRef = useRef<Group>(null)
  const edge = size / 2 - THICKNESS / 2

  const bars: { args: [number, number]; position: [number, number, number] }[] = [
    { args: [size, THICKNESS], position: [0, edge, 0] },
    { args: [size, THICKNESS], position: [0, -edge, 0] },
    { args: [THICKNESS, size], position: [-edge, 0, 0] },
    { args: [THICKNESS, size], position: [edge, 0, 0] },
  ]

  useFrame((state) => {
    const group = groupRef.current
    if (!group) {
      return
    }
    const opacity = 0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 8)
    for (const child of group.children) {
      const material = (child as Mesh).material as MeshBasicMaterial
      material.opacity = opacity
    }
    invalidate()
  })

  return (
    <group position={[centerX, -centerY, 0]} ref={groupRef} renderOrder={RENDER_ORDER.cursor}>
      {bars.map((bar, index) => (
        <mesh key={index} position={bar.position} renderOrder={RENDER_ORDER.cursor}>
          <planeGeometry args={bar.args} />
          <meshBasicMaterial color={color} depthTest={false} depthWrite={false} transparent />
        </mesh>
      ))}
    </group>
  )
}

export default Cursor
