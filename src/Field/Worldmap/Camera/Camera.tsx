import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'

import { getPlayerEntity } from '../../Scripts/Script/Model/modelUtils'
import useKeyboardControls from '../../Scripts/Script/Model/useKeyboardControls'
import { IS_FLYING } from '../useWorldMapControls'

const Camera = () => {
  const movementFlags = useKeyboardControls()
  const cumulativePanRef = useRef(0)
  useFrame(({ camera, scene }) => {
    const player = getPlayerEntity(scene)
    if (!player) {
      return
    }
    const mesh = player.getObjectByName('Scene')!.parent
    if (!mesh) {
      return
    }

    camera.up.set(0, 0, 1)
    const currentCameraX = camera.position.x
    const currentCameraY = camera.position.y
    const facingPosition = new Vector3().copy(mesh.position)
    facingPosition.z += IS_FLYING ? 25 : 8
    facingPosition.y -= 8
    camera.position.copy(facingPosition)
    camera.lookAt(mesh.position)

    const xAdjustment = movementFlags.panLeft || movementFlags.panRight ? (movementFlags.panLeft ? 1 : -1) * 0.2 : 0
    cumulativePanRef.current += xAdjustment
    const angle = (cumulativePanRef.current / 100) * Math.PI * 2

    const offset = camera.position.clone().sub(mesh.position)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const newX = offset.x * cos - offset.y * sin
    const newY = offset.x * sin + offset.y * cos
    camera.position.set(mesh.position.x + newX, mesh.position.y + newY, camera.position.z)

    camera.lookAt(mesh.position)
  })

  return <PerspectiveCamera fov={75} makeDefault name="worldmapCamera" position={[0, 0, 10]} />
}

export default Camera
