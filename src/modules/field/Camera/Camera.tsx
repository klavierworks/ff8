import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { clamp } from 'three/src/math/MathUtils.js'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import { CONTROLS_MAP } from '../../../constants/controls'
import LerpValue from '../../../LerpValue'
import useGlobalStore from '../../../store'
import { FieldData } from '../Field'
import { movieController } from '../movieController'
import useScrollTransition from '../useScrollTransition'
import { applyFieldCamera, getBoundaries, getCameraDirections, getCameraRangeIndex } from './cameraUtils'
import Focus from './Focus/Focus'
import useScreenShake from './useScreenShake'

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
  const { cameraRanges, cameras, limits } = data

  const [initialCameraTargetPosition, setInitialCameraTargetPosition] = useState(new Vector3())

  const activeCameraId = useGlobalStore((state) => state.activeCameraId)
  const moveableCamera = useThree(({ camera }) => camera as PerspectiveCamera)
  const camera = useThree(({ scene }) => scene.getObjectByName('sceneCamera') as PerspectiveCamera)

  const scrollSpring = useScrollTransition('camera')
  const shake = useScreenShake()

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)
  useEffect(() => {
    const lookAtTarget = applyFieldCamera(camera, moveableCamera, cameras[activeCameraId])
    setInitialCameraTargetPosition(lookAtTarget)
  }, [activeCameraId, camera, cameras, data, isDebugMode, moveableCamera])

  const lastMovieCameraRef = useRef<FieldData['cameras'][number]>(undefined)
  const applyMovieCamera = () => {
    const movieCamera = movieController.getMovieCamera()
    if (!movieCamera) {
      if (lastMovieCameraRef.current) {
        lastMovieCameraRef.current = undefined
        applyFieldCamera(camera, moveableCamera, cameras[activeCameraId])
      }
      return false
    }
    if (movieCamera !== lastMovieCameraRef.current) {
      lastMovieCameraRef.current = movieCamera
      applyFieldCamera(camera, moveableCamera, movieCamera)
      camera.clearViewOffset()
      moveableCamera.clearViewOffset()
    }
    return true
  }

  const boundaries = useMemo(
    () => getBoundaries(cameraRanges[getCameraRangeIndex(activeCameraId)], limits.screenRange),
    [activeCameraId, cameraRanges, limits],
  )

  useFrame(({ scene }) => {
    if (applyMovieCamera()) {
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

    const cameraZoom = cameras[activeCameraId].camera_zoom
    const scale = cameraZoom / camSpaceZ
    const lookAtScale = cameraZoom / lookAtSpaceZ

    const panX = camSpaceX * scale + lookAtSpaceX * lookAtScale
    const panY = -1 * camSpaceY * scale + lookAtSpaceY * lookAtScale

    const clippedPanX = clamp(panX, boundaries.left, boundaries.right)
    const clippedPanY = clamp(panY, boundaries.top, boundaries.bottom)

    const { positioning, x: scrollX, y: scrollY } = scrollSpring.current

    let finalPanX: number
    let finalPanY: number
    if (activeCameraId !== 0) {
      finalPanX = clippedPanX
      finalPanY = clippedPanY
    } else if (positioning === 'camera') {
      finalPanX = clamp(clippedPanX + scrollX, boundaries.left, boundaries.right)
      finalPanY = clamp(clippedPanY + scrollY, boundaries.top, boundaries.bottom)
    } else {
      finalPanX = scrollX
      finalPanY = scrollY
    }

    const viewOffsetX = finalPanX - shake.x.get()
    const viewOffsetY = finalPanY - shake.y.get()

    if (viewOffsetX === 0 && viewOffsetY === 0) {
      camera.clearViewOffset()
      moveableCamera.clearViewOffset()
      return
    }

    camera.setViewOffset(SCREEN_WIDTH, SCREEN_HEIGHT, viewOffsetX, viewOffsetY, SCREEN_WIDTH, SCREEN_HEIGHT)
    camera.updateProjectionMatrix()
    moveableCamera.setViewOffset(SCREEN_WIDTH, SCREEN_HEIGHT, viewOffsetX, viewOffsetY, SCREEN_WIDTH, SCREEN_HEIGHT)
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
