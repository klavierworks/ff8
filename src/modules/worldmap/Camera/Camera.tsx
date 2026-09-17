import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { PerspectiveCamera as PerspectiveCameraImpl } from 'three'

import { SCREEN_HEIGHT } from '../../../constants/constants'
import { WORLDMAP_CAMERA_FAR_PSX, WORLDMAP_CAMERA_NEAR, WORLDMAP_ZOOM_DEFAULT } from '../../../constants/worldmapCamera'
import useGlobalStore from '../../../store'
import { calculateFOV } from '../../field/Camera/cameraUtils'
import { getScriptFrame } from '../../field/scriptClock'
import { WORLDMAP_SCALE } from '../constants'
import useSections from '../useSections'
import { advanceCameraMemory, applyCameraMemory } from './cameraBridge'
import { CameraMemory } from './cameraTick'

const CAMERA_FAR = WORLDMAP_CAMERA_FAR_PSX * WORLDMAP_SCALE
const INITIAL_FOV = calculateFOV(WORLDMAP_ZOOM_DEFAULT, SCREEN_HEIGHT)

const Camera = () => {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const memoryRef = useRef<CameraMemory | null>(null)
  const scene = useThree((state) => state.scene)
  const sections = useSections()

  useFrame(() => {
    const camera = cameraRef.current
    const playerPosition = useGlobalStore.getState().characterPosition
    if (!camera || !playerPosition) {
      return
    }
    const tick = getScriptFrame()
    if (memoryRef.current?.lastTick === tick) {
      return
    }
    const landings = sections.section_8_field_landing_positions.positions
    memoryRef.current = advanceCameraMemory(memoryRef.current, { camera, landings, playerPosition, scene, tick })
    applyCameraMemory(camera, memoryRef.current)
  })

  return (
    <PerspectiveCamera far={CAMERA_FAR} fov={INITIAL_FOV} makeDefault near={WORLDMAP_CAMERA_NEAR} ref={cameraRef} />
  )
}

export default Camera
