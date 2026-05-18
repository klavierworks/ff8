import { Sphere } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Group, Mesh, Object3D, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { getPlayerEntity } from '../../Scripts/Script/Model/modelUtils'

const START_FOCUS_VECTOR = new Vector3(0, 0, 0)
const END_FOCUS_VECTOR = new Vector3(0, 0, 0)

const Focus = () => {
  const focusRef = useRef<Mesh>(null)

  const cameraFocusObject = useGlobalStore((state) => state.cameraFocusObject)
  const cameraFocusSpring = useGlobalStore((state) => state.cameraFocusSpring)

  const [currentFocusObject, setCurrentFocusObject] = useState<null | Object3D>(null)
  const [targetFocusObject, setTargetFocusObject] = useState<null | Object3D>(null)

  const scene = useThree((state) => state.scene)

  useEffect(() => {
    if (!cameraFocusObject) {
      return
    }

    const targetMesh = cameraFocusObject.getObjectByName('model') as Group
    if (!targetMesh) {
      console.warn('Bad camera focus, no inner model!')
      return
    }

    if (targetMesh === targetFocusObject) {
      return
    }

    setTargetFocusObject((currentValue) => {
      setCurrentFocusObject(currentValue)
      return targetMesh
    })
  }, [cameraFocusObject, cameraFocusSpring, targetFocusObject])

  useFrame(() => {
    if (!focusRef.current) {
      return
    }

    let focusObject = currentFocusObject
    if (!currentFocusObject) {
      const player = getPlayerEntity(scene)
      focusObject = player?.getObjectByName('model') as Group
    }

    if (!focusObject) {
      return
    }

    const startFocusPosition = focusObject.getWorldPosition(START_FOCUS_VECTOR)
    startFocusPosition.z += focusObject.userData.focusZPosition

    if (!targetFocusObject || currentFocusObject === targetFocusObject || !cameraFocusSpring) {
      focusRef.current.position.copy(startFocusPosition)
      return
    }

    const springValue = cameraFocusSpring.get()

    const endFocusPosition = targetFocusObject.getWorldPosition(END_FOCUS_VECTOR)
    endFocusPosition.z += targetFocusObject.userData.focusZPosition

    focusRef.current.position.lerpVectors(startFocusPosition, endFocusPosition, springValue)
  })

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  return (
    <Sphere args={[0.01, 32, 32]} name="focus" position={[0, 0, 0]} ref={focusRef}>
      <meshBasicMaterial color="pink" opacity={0.8} transparent visible={isDebugMode} />
    </Sphere>
  )
}

export default Focus
