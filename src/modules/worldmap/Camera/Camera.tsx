import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { PerspectiveCamera as PerspectiveCameraImpl, Vector3 } from 'three'

import { SCREEN_HEIGHT } from '../../../constants/constants'
import useGlobalStore from '../../../store'
import { TARGET_FPS } from '../../../timing'
import { calculateFOV } from '../../field/Camera/cameraUtils'
import { PSX_ANGLE_TO_RAD, WORLD_WRAP_X, WORLD_WRAP_Z, WORLDMAP_SCALE } from '../constants'
import { VEHICLE_RAGNAROK } from '../Player/FlyingRagnarok/flightConstants'
import useWorldmapStore from '../worldmapStore'
import {
  applyForwardLead,
  computeRagnarokPitchTarget,
  computeWorldmapCameraPosition,
  frameRateAdjustedAlpha,
  smoothFollowAxis,
  stepPitchManual,
  stepPitchTowardTarget,
  stepToward,
  stepZoom,
  WORLDMAP_CAMERA_MODES,
} from './cameraUtils'

const DEFAULT_TARGET = new Vector3(WORLD_WRAP_X / 2, 0, WORLD_WRAP_Z / 2)

// Camera vertical orbit / depth offset, set per-vehicle. All vehicles orbit at
// 5216 PSX units except Ragnarok, which orbits ~17.8% deeper at 6144.
const ORBIT_DISTANCE_BASE = 5216 * WORLDMAP_SCALE
const ORBIT_DISTANCE_BY_VEHICLE: Record<number, number> = {
  [VEHICLE_RAGNAROK]: 6144 * WORLDMAP_SCALE,
}
// Orbit distance retargets at ±128 PSX/frame (~0.5 s across the 5216 ⇄ 6144 range).
const ORBIT_DISTANCE_TRANSITION_RATE = 128 * TARGET_FPS * WORLDMAP_SCALE
const FORWARD_LEAD_WORLD = 256 * WORLDMAP_SCALE
const XZ_SMOOTH_ALPHA = 0.5
const YAW_SPEED_RADIANS_PER_SECOND = 2.0
const PITCH_SPEED_RADIANS_PER_SECOND = 1.0
const PITCH_MIN_RADIANS = Math.PI / 8
const PITCH_MAX_RADIANS = (70 * Math.PI) / 180
const ZOOM_STEP_PER_SECOND = 8 * TARGET_FPS
// Ragnarok zoom is fixed for all vehicles; the 640 zoom preset is non-vehicle only.
const RAGNAROK_ZOOM = 1024
// On-foot pitch eases toward its target at ±4 PSX-angle/frame.
const PITCH_STEP_RADIANS_PER_SECOND = 4 * TARGET_FPS * PSX_ANGLE_TO_RAD
// Ragnarok pitch eases toward its target at ±32 PSX-angle/frame.
const RAGNAROK_PITCH_STEP_RADIANS_PER_SECOND = 32 * TARGET_FPS * PSX_ANGLE_TO_RAD

const orbitDistanceForVehicle = (vehicleId: number): number =>
  ORBIT_DISTANCE_BY_VEHICLE[vehicleId] ?? ORBIT_DISTANCE_BASE

const _target = new Vector3()
const _smoothedTarget = new Vector3()
const _cameraPosition = new Vector3()

const Camera = () => {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const smoothedTarget = useRef(new Vector3())
  const isInitialised = useRef(false)

  const cameraModeIndex = useWorldmapStore((state) => state.cameraModeIndex)
  const cameraMode = WORLDMAP_CAMERA_MODES[cameraModeIndex] ?? WORLDMAP_CAMERA_MODES[0]
  const initialFov = calculateFOV(cameraMode.zoom, SCREEN_HEIGHT)

  const pitchRadiansRef = useRef(cameraMode.pitchAboveHorizonRadians)
  const zoomRef = useRef(cameraMode.zoom)
  const orbitDistanceRef = useRef(orbitDistanceForVehicle(useWorldmapStore.getState().vehicleId))

  useFrame((_, delta) => {
    const camera = cameraRef.current
    if (!camera) {
      return
    }

    const { camera: cameraState, controls, ragnarokCameraTiltPsx, vehicleId } = useWorldmapStore.getState()
    const { cameraPitch, cameraYaw } = controls
    const isRagnarok = vehicleId === VEHICLE_RAGNAROK

    _target.copy(useGlobalStore.getState().characterPosition ?? DEFAULT_TARGET)

    if (!isInitialised.current) {
      smoothedTarget.current.copy(_target)
      isInitialised.current = true
    }

    const alphaXZ = frameRateAdjustedAlpha(XZ_SMOOTH_ALPHA, delta)
    smoothedTarget.current.x = smoothFollowAxis(smoothedTarget.current.x, _target.x, alphaXZ, WORLD_WRAP_X)
    smoothedTarget.current.z = smoothFollowAxis(smoothedTarget.current.z, _target.z, alphaXZ, WORLD_WRAP_Z)
    smoothedTarget.current.y = _target.y

    const yawRadians = cameraState.yawRadians - cameraYaw * YAW_SPEED_RADIANS_PER_SECOND * delta
    useWorldmapStore.setState({ camera: { yawRadians } })

    _smoothedTarget.copy(smoothedTarget.current)
    applyForwardLead(_smoothedTarget, yawRadians, FORWARD_LEAD_WORLD)

    const targetPitchRadians = isRagnarok
      ? computeRagnarokPitchTarget(ragnarokCameraTiltPsx)
      : cameraMode.pitchAboveHorizonRadians
    const pitchStepPerSecond = isRagnarok ? RAGNAROK_PITCH_STEP_RADIANS_PER_SECOND : PITCH_STEP_RADIANS_PER_SECOND

    if (cameraPitch !== 0) {
      pitchRadiansRef.current = stepPitchManual(
        pitchRadiansRef.current,
        cameraPitch,
        PITCH_SPEED_RADIANS_PER_SECOND,
        delta,
        PITCH_MIN_RADIANS,
        PITCH_MAX_RADIANS,
      )
    } else {
      pitchRadiansRef.current = stepPitchTowardTarget(
        pitchRadiansRef.current,
        targetPitchRadians,
        pitchStepPerSecond,
        delta,
      )
    }

    const targetZoom = isRagnarok ? RAGNAROK_ZOOM : cameraMode.zoom
    zoomRef.current = stepZoom(zoomRef.current, targetZoom, ZOOM_STEP_PER_SECOND, delta)
    const fov = calculateFOV(zoomRef.current, SCREEN_HEIGHT)

    orbitDistanceRef.current = stepToward(
      orbitDistanceRef.current,
      orbitDistanceForVehicle(vehicleId),
      ORBIT_DISTANCE_TRANSITION_RATE * delta,
    )

    computeWorldmapCameraPosition(
      _smoothedTarget,
      yawRadians,
      pitchRadiansRef.current,
      orbitDistanceRef.current,
      _cameraPosition,
    )
    camera.position.copy(_cameraPosition)
    camera.up.set(0, 1, 0)
    camera.lookAt(_smoothedTarget)

    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return <PerspectiveCamera far={4000} fov={initialFov} makeDefault near={0.01} ref={cameraRef} />
}

export default Camera
