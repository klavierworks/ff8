import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { clamp } from 'three/src/math/MathUtils.js'

import createMovementController from '../MovementController/MovementController'
import { getPlayerEntity } from './modelUtils'

type useFootstepsProps = {
  movementController: ReturnType<typeof createMovementController>
}

const useFootsteps = ({ movementController }: useFootstepsProps) => {
  const previousFootstepRef = useRef<'left' | 'right' | undefined>(undefined)
  const isBetweenFootstepsRef = useRef(false)
  const [playerPosition] = useState<Vector3>(new Vector3(0, 0, 0))
  const FOOTSTEP_DELAY_RUNNING = 420
  const FOOTSTEP_DELAY_WALKING = 500

  useFrame(({ scene }) => {
    const { footsteps, isClimbingLadder, movementSpeed, position } = movementController.getState()

    const camera = scene.getObjectByName('sceneCamera') as PerspectiveCamera
    const isAnimating = position.waypoints
    const hasFootsteps = footsteps.isActive
    const isWalking = movementSpeed < 2695

    if (!isAnimating || !hasFootsteps || isBetweenFootstepsRef.current || isClimbingLadder) {
      return
    }

    const { leftSound, rightSound } = movementController.getState().footsteps

    if (!leftSound || !rightSound) {
      return
    }

    const player = getPlayerEntity(scene)
    if (!player) {
      return
    }
    player.getWorldPosition(playerPosition)
    const distance = playerPosition.distanceTo(camera.position)

    const nextFootstep = previousFootstepRef.current === 'right' ? leftSound : rightSound
    isBetweenFootstepsRef.current = true
    nextFootstep.seek(0)
    nextFootstep.volume(clamp(0.1, (isWalking ? 0.5 : 1) * (2 - distance), 0.3))
    nextFootstep.play()
    previousFootstepRef.current = previousFootstepRef.current === 'right' ? 'left' : 'right'

    window.setTimeout(
      () => {
        isBetweenFootstepsRef.current = false
      },
      isWalking ? FOOTSTEP_DELAY_WALKING : FOOTSTEP_DELAY_RUNNING,
    )
  })
}

export default useFootsteps
