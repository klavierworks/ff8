import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { clamp } from 'three/src/math/MathUtils.js'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import { CONTROLS_MAP } from '../../../constants/controls'
import LerpValue from '../../../LerpValue'
import useGlobalStore from '../../../store'
import { vectorToFloatingPoint } from '../../../utils'
import { FieldData } from '../Field'
import useScrollTransition from '../useScrollTransition'
import { calculateFOV, getBoundaries, getCameraDirections } from './cameraUtils'
import Focus from './Focus/Focus'

type CameraProps = {
  data: FieldData
}

const _focusWorldPosition = new Vector3()
const _entityDelta = new Vector3()
const _lookAtDelta = new Vector3()
const _lookingAtQuaternion = new Quaternion()
const _slerpedQuaternion = new Quaternion()
const _scenePosition = new Vector3()
const _debugPosition = new Vector3()
const _scaledForward = new Vector3()
const _scaledRight = new Vector3()
const _scaledUp = new Vector3()

const Camera = ({ data }: CameraProps) => {
  const { cameras, limits } = data

  const [initialCameraTargetPosition, setInitialCameraTargetPosition] = useState(new Vector3())

  const activeCameraId = useGlobalStore((state) => state.activeCameraId)
  const moveableCamera = useThree(({ camera }) => camera as PerspectiveCamera)
  const camera = useThree(({ scene }) => scene.getObjectByName('sceneCamera') as PerspectiveCamera)

  const scrollSpring = useScrollTransition('camera')

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)
  useEffect(() => {
    const { camera_axis, camera_position, camera_zoom } = cameras[activeCameraId]

    camera.far = 100
    moveableCamera.far = 100
    camera.near = 0.000001
    moveableCamera.near = 0.000001

    const camAxisX = vectorToFloatingPoint(camera_axis[0])
    const camAxisY = vectorToFloatingPoint(camera_axis[1]).negate()
    const camAxisZ = vectorToFloatingPoint(camera_axis[2])

    const camPos = vectorToFloatingPoint(new Vector3(...camera_position))
    camPos.y = -camPos.y

    const tx = -(camPos.x * camAxisX.x + camPos.y * camAxisY.x + camPos.z * camAxisZ.x)
    const ty = -(camPos.x * camAxisX.y + camPos.y * camAxisY.y + camPos.z * camAxisZ.y)
    const tz = -(camPos.x * camAxisX.z + camPos.y * camAxisY.z + camPos.z * camAxisZ.z)

    const lookAtTarget = new Vector3(tx + camAxisZ.x, ty + camAxisZ.y, tz + camAxisZ.z)

    camera.position.set(tx, ty, tz)
    moveableCamera.position.set(tx, ty, tz)

    camera.up.set(camAxisY.x, camAxisY.y, camAxisY.z)
    moveableCamera.up.set(camAxisY.x, camAxisY.y, camAxisY.z)

    camera.lookAt(lookAtTarget)
    moveableCamera.lookAt(lookAtTarget)

    camera.fov = calculateFOV(camera_zoom, SCREEN_HEIGHT)
    moveableCamera.fov = camera.fov

    camera.updateProjectionMatrix()
    moveableCamera.updateProjectionMatrix()

    const direction = new Vector3(0, 0, -1)
    direction.applyQuaternion(new Quaternion().setFromEuler(camera.rotation))

    const { rightVector, upVector } = getCameraDirections(camera)

    camera.userData = {
      forwardAxis: camAxisZ.clone(),
      initialDirection: direction.clone(),
      initialPosition: camera.position.clone(),
      initialTargetPosition: lookAtTarget.clone(),
      rightAxis: rightVector.clone(),
      upAxis: upVector.clone(),
    }

    setInitialCameraTargetPosition(lookAtTarget.clone())
  }, [activeCameraId, camera, cameras, data, isDebugMode, moveableCamera])

  const boundaries = useMemo(() => getBoundaries(limits), [limits])

  useFrame(({ scene }) => {
    if (activeCameraId !== 0) {
      return
    }

    const focusObject = scene.getObjectByName('focus')

    if (!initialCameraTargetPosition || !focusObject) {
      return
    }

    camera.lookAt(initialCameraTargetPosition)

    const entityPos = _focusWorldPosition
    focusObject.getWorldPosition(entityPos)

    const { forwardAxis, rightAxis, upAxis } = camera.userData as {
      forwardAxis: Vector3
      rightAxis: Vector3
      upAxis: Vector3
    }
    const delta = _entityDelta.copy(entityPos).sub(camera.position)
    const lookAtDelta = _lookAtDelta.copy(initialCameraTargetPosition).sub(camera.position)

    const camSpaceX = rightAxis.dot(delta)
    const camSpaceY = upAxis.dot(delta)
    const camSpaceZ = forwardAxis.dot(delta)

    const lookAtSpaceX = rightAxis.dot(lookAtDelta)
    const lookAtSpaceY = upAxis.dot(lookAtDelta)
    const lookAtSpaceZ = forwardAxis.dot(lookAtDelta)

    const cameraZoom = data.cameras[0].camera_zoom
    const scale = cameraZoom / camSpaceZ
    const lookAtScale = cameraZoom / lookAtSpaceZ

    const panX = camSpaceX * scale + lookAtSpaceX * lookAtScale
    const panY = -1 * camSpaceY * scale + lookAtSpaceY * lookAtScale

    const clippedPanX = clamp(panX, boundaries.left, boundaries.right)
    const clippedPanY = clamp(panY, boundaries.top, boundaries.bottom)

    const { positioning, x: scrollX, y: scrollY } = scrollSpring.current

    let finalPanX: number
    let finalPanY: number
    if (positioning === 'camera') {
      finalPanX = clippedPanX + scrollX
      finalPanY = clippedPanY - scrollY
    } else {
      finalPanX = scrollX
      finalPanY = -scrollY
    }

    if (finalPanX === 0 && finalPanY === 0) {
      camera.clearViewOffset()
      moveableCamera.clearViewOffset()
      return
    }

    camera.setViewOffset(SCREEN_WIDTH, SCREEN_HEIGHT, finalPanX, finalPanY, SCREEN_WIDTH, SCREEN_HEIGHT)
    camera.updateProjectionMatrix()
    moveableCamera.setViewOffset(SCREEN_WIDTH, SCREEN_HEIGHT, finalPanX, finalPanY, SCREEN_WIDTH, SCREEN_HEIGHT)
    moveableCamera.updateProjectionMatrix()
  })

  const [isDebugModeActive, setIsDebugModeActive] = useState(false)
  const [pullback] = useState(new LerpValue(0))

  useEffect(() => {
    if (isDebugModeActive) {
      useGlobalStore.setState({ isDebugMode: true })
    }
    pullback.start(isDebugModeActive ? 1 : 0, 300).then(() => {
      if (!isDebugModeActive) {
        useGlobalStore.setState({ isDebugMode: false })
      }
    })
  }, [isDebugModeActive, pullback])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === CONTROLS_MAP.debug) {
        setIsDebugModeActive((state) => !state)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useFrame(({ scene }) => {
    if (!moveableCamera) {
      return
    }

    const focus = scene.getObjectByName('focus')
    if (!focus) {
      return
    }

    moveableCamera.lookAt(focus.position)
    const lookingAtQuaternion = _lookingAtQuaternion.copy(moveableCamera.quaternion)
    moveableCamera.quaternion.copy(
      _slerpedQuaternion.copy(camera.quaternion).slerp(lookingAtQuaternion, pullback.get()),
    )

    const { forwardVector, rightVector, upVector } = getCameraDirections(camera)

    const scenePosition = _scenePosition.copy(camera.position)
    const debugPosition = _debugPosition.copy(camera.position)
    debugPosition.sub(_scaledForward.copy(forwardVector).multiplyScalar(0.1))
    debugPosition.sub(_scaledRight.copy(rightVector).multiplyScalar(0))
    debugPosition.add(_scaledUp.copy(upVector).multiplyScalar(0.1))

    moveableCamera.position.copy(scenePosition.lerp(debugPosition, pullback.get()))

    moveableCamera.fov = camera.fov
    moveableCamera.updateProjectionMatrix()
  })
  return <Focus />
}

export default Camera
