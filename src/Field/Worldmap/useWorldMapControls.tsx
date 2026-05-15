import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useState } from 'react'
import { Vector3 } from 'three'

import useGlobalStore from '../../store'
import { getPlayerEntity } from '../Scripts/Script/Model/modelUtils'
import useKeyboardControls from '../Scripts/Script/Model/useKeyboardControls'
import createMovementController from '../Scripts/Script/MovementController/MovementController'
import createRotationController from '../Scripts/Script/RotationController/RotationController'
import { convert256ToRadians } from '../Scripts/Script/utils'
import WorldmapMeshController from './WorldmapMovementController'

export const IS_FLYING = false
const SPEED = IS_FLYING ? 250 : 7
const DESIRED_POSITION_VECTOR = new Vector3(0, 0, 0)

const useWorldMapControls = ({
  movementController,
  rotationController,
  worldmapMeshController,
}: {
  movementController: ReturnType<typeof createMovementController>
  rotationController: ReturnType<typeof createRotationController>
  worldmapMeshController: WorldmapMeshController
}) => {
  const characterStartPosition = useGlobalStore((state) => state.characterPosition)
  useEffect(() => {
    if (characterStartPosition) {
      movementController.setPosition(characterStartPosition)
    }
  }, [characterStartPosition, movementController])

  const movementFlags = useKeyboardControls()
  const handleMovement = useCallback(() => {
    let x = 0
    let y = 0

    if (movementFlags.forward) {
      y += 1
    }
    if (movementFlags.backward) {
      y -= 1
    }
    if (movementFlags.right) {
      x -= 1
    }
    if (movementFlags.left) {
      x += 1
    }

    if (x === 0 && y === 0) {
      return null
    }

    const radians = Math.atan2(x, y)

    const angle = Math.round((radians / Math.PI) * 128) - 128 + 256

    return angle
  }, [movementFlags])

  const [forwardDirection] = useState(new Vector3(0, -1, 0))
  const [upDirection] = useState(new Vector3(0, 0, 1))
  const [POSITION_VECTOR] = useState(new Vector3())

  useFrame(async ({ scene }, delta: number) => {
    const { isPaused, userControlledSpeed, waypoints } = movementController.getState().position
    if (waypoints && userControlledSpeed !== undefined && !isPaused) {
      return
    }

    const player = getPlayerEntity(scene)
    if (!player) {
      console.warn('No player entity found in scene')
      return
    }

    const movementAngle = handleMovement()
    if (movementAngle === null) {
      movementController.setUserControlledSpeed(0)
      return
    }

    rotationController.turnToFaceAngle(movementAngle, 0)

    const currentPosition = movementController.getPosition()
    if (!currentPosition) {
      movementController.setUserControlledSpeed(0)
      return
    }

    upDirection.set(0, 0, 1)
    const meshUp = upDirection.applyQuaternion(player.quaternion).normalize()

    forwardDirection.set(0, -1, 0)
    const meshForward = forwardDirection.applyAxisAngle(meshUp, convert256ToRadians(movementAngle)).normalize()

    const moveDistance = SPEED * delta
    DESIRED_POSITION_VECTOR.copy(currentPosition).add(meshForward.multiplyScalar(moveDistance))

    const newPosition = worldmapMeshController.getNextPositionOnWalkmesh(
      POSITION_VECTOR.set(currentPosition.x, currentPosition.y, currentPosition.z),
      meshForward,
      moveDistance,
    )

    movementController.setPosition(newPosition)
    movementController.setHasMoved(true)
    movementController.setUserControlledSpeed(7650)
  })
}

export default useWorldMapControls
