import { useFrame } from '@react-three/fiber'
import { RefObject, useEffect, useMemo, useRef } from 'react'
import { Mesh, Texture } from 'three'

import { CURSOR_RENDER_ORDER } from '../../../constants'
import { MapCell } from '../../../minimapUtils'
import { createPsxMaterial } from '../../psxPrimitives'
import { calculateCursorScreenPosition, createCursorGeometry } from './mapCursorUtils'

type MapCursorProps = {
  cursorRef: RefObject<MapCell>
  texture: Texture
}

const MapCursor = ({ cursorRef, texture }: MapCursorProps) => {
  const meshRef = useRef<Mesh>(null)
  const geometry = useMemo(createCursorGeometry, [])
  const material = useMemo(() => createPsxMaterial('opaque', texture), [texture])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }
    const { x, y } = calculateCursorScreenPosition(cursorRef.current)
    mesh.position.set(x, y, 0)
  })

  return (
    <mesh
      frustumCulled={false}
      geometry={geometry}
      material={material}
      ref={meshRef}
      renderOrder={CURSOR_RENDER_ORDER}
    />
  )
}

export default MapCursor
