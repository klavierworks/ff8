import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject } from 'react'
import { Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { TARGET_FPS } from '../../../timing'
import { stepToward } from '../Camera/cameraUtils'
import { WORLDMAP_SCALE } from '../constants'
import useWorldmapStore from '../worldmapStore'
import { radiansToPsx, shortestPsxDelta, wrapPsxAngle } from './playerAngles'
import { findGroundY, PLAYER_Y_OFFSET } from './playerUtils'

const _yAxis = new Vector3(0, 1, 0)
const _input = new Vector3()
const _velocity = new Vector3()

const MAX_SPEED_PSX_PER_FRAME = 32
const MAX_SPEED_THREE_PER_SECOND = MAX_SPEED_PSX_PER_FRAME * TARGET_FPS * WORLDMAP_SCALE
const DECEL_THREE_PER_SECOND_SQ = 4 * TARGET_FPS * TARGET_FPS * WORLDMAP_SCALE
const PLAYER_YAW_STEP_PSX_PER_SECOND = 256 * TARGET_FPS
const Y_SETTLE_THREE_PER_SECOND = 4

const stepPsxAngle = (current: number, target: number, maxStep: number) => {
  const delta = shortestPsxDelta(current, target)
  if (Math.abs(delta) <= maxStep) {
    return wrapPsxAngle(target)
  }
  return wrapPsxAngle(current + Math.sign(delta) * maxStep)
}

const useMovement = (speedRef: MutableRefObject<number>) => {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  useFrame((_, delta) => {
    const store = useGlobalStore.getState()
    const position = store.characterPosition
    if (!position) {
      return
    }

    const { moveX, moveY } = useWorldmapStore.getState().controls
    const hasInput = moveX !== 0 || moveY !== 0

    if (hasInput) {
      _input.set(moveX, 0, -moveY).normalize()
      const cameraYaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10])
      _velocity.copy(_input).applyAxisAngle(_yAxis, cameraYaw).multiplyScalar(MAX_SPEED_THREE_PER_SECOND)
    } else {
      const speed = _velocity.length()
      if (speed === 0) {
        speedRef.current = 0
        const groundY = findGroundY(scene, position.x, position.z)
        if (groundY === undefined) {
          return
        }
        const targetY = groundY + PLAYER_Y_OFFSET
        const nextY = stepToward(position.y, targetY, Y_SETTLE_THREE_PER_SECOND * delta)
        if (nextY === position.y) {
          return
        }
        position.set(position.x, nextY, position.z)
        return
      }
      const nextSpeed = Math.max(0, speed - DECEL_THREE_PER_SECOND_SQ * delta)
      if (nextSpeed === 0) {
        _velocity.set(0, 0, 0)
        speedRef.current = 0
        return
      }
      _velocity.multiplyScalar(nextSpeed / speed)
    }

    speedRef.current = _velocity.length()

    const tentativeX = position.x + _velocity.x * delta
    const tentativeZ = position.z + _velocity.z * delta

    const groundY = findGroundY(scene, tentativeX, tentativeZ)
    if (groundY === undefined) {
      return
    }
    const targetY = groundY + PLAYER_Y_OFFSET
    const nextY = stepToward(position.y, targetY, Y_SETTLE_THREE_PER_SECOND * delta)

    const nextFieldDirection = stepPsxAngle(
      store.fieldDirection,
      radiansToPsx(Math.atan2(_velocity.x, _velocity.z)),
      PLAYER_YAW_STEP_PSX_PER_SECOND * delta,
    )

    position.set(tentativeX, nextY, tentativeZ)
    useGlobalStore.setState({ fieldDirection: nextFieldDirection })
  })
}

export default useMovement
