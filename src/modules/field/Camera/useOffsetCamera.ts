import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'

import { CONTROLS_MAP } from '../../../constants/controls'
import LerpValue from '../../../LerpValue'
import useGlobalStore from '../../../store'
import useFieldRevealStore from '../fieldRevealStore'
import {
  applyDragToOrbit,
  calculatePulledBackPosition,
  CameraOrbit,
  getIntroCameraAmount,
  INITIAL_DEBUG_ORBIT,
  orbitAroundFocus,
  selectCameraOffset,
} from './cameraUtils'

const _pulledBackPosition = new Vector3()
const _orbitPosition = new Vector3()
const _lookingAtQuaternion = new Quaternion()

const useDebugToggle = () => {
  const [isDebugModeActive, setIsDebugModeActive] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === CONTROLS_MAP.debug) {
        setIsDebugModeActive((state) => !state)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return isDebugModeActive
}

const useOrbitDrag = (isEnabled: boolean) => {
  const orbitRef = useRef<CameraOrbit>(INITIAL_DEBUG_ORBIT)

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) {
        return
      }
      orbitRef.current = applyDragToOrbit(orbitRef.current, event.movementX, event.movementY)
    }
    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [isEnabled])

  return orbitRef
}

const useDebugOffset = () => {
  const isDebugModeActive = useDebugToggle()
  const orbitRef = useOrbitDrag(isDebugModeActive)
  const [pullback] = useState(() => new LerpValue(0))

  useEffect(() => {
    if (isDebugModeActive) {
      useGlobalStore.setState({ isDebugMode: true })
    }
    pullback.start(isDebugModeActive ? 1 : 0, 300).then(() => {
      if (isDebugModeActive || pullback.get() !== 0) {
        return
      }
      useGlobalStore.setState({ isDebugMode: false })
      orbitRef.current = INITIAL_DEBUG_ORBIT
    })
  }, [isDebugModeActive, orbitRef, pullback])

  return { orbitRef, pullback }
}

const useOffsetCamera = (camera: PerspectiveCamera, moveableCamera: PerspectiveCamera) => {
  const { orbitRef, pullback } = useDebugOffset()

  useFrame(({ scene }) => {
    const focus = scene.getObjectByName('focus')
    if (!focus) {
      return
    }

    const { stage, stageProgress } = useFieldRevealStore.getState()
    const { amount, orbit } = selectCameraOffset(
      pullback.get(),
      orbitRef.current,
      getIntroCameraAmount(stage, stageProgress.value),
    )

    const pulledBackPosition = calculatePulledBackPosition(camera, _pulledBackPosition)
    const orbitPosition = orbitAroundFocus(pulledBackPosition, focus.position, moveableCamera.up, orbit, _orbitPosition)

    moveableCamera.position.copy(orbitPosition)
    moveableCamera.lookAt(focus.position)
    _lookingAtQuaternion.copy(moveableCamera.quaternion)

    moveableCamera.quaternion.slerpQuaternions(camera.quaternion, _lookingAtQuaternion, amount)
    moveableCamera.position.lerpVectors(camera.position, orbitPosition, amount)

    moveableCamera.fov = camera.fov
    moveableCamera.updateProjectionMatrix()
  })
}

export default useOffsetCamera
