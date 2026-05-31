import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'

import { createAnimationController } from '../AnimationController/AnimationController'
import createMovementController from '../MovementController/MovementController'
import { type Foot, getNextFoot, hasFootPlanted, triggerFootstep } from './footsteps'
import { getPlayerEntity } from './modelUtils'

type useFootstepsProps = {
  animationController: ReturnType<typeof createAnimationController>
  movementController: ReturnType<typeof createMovementController>
}

const useFootsteps = ({ animationController, movementController }: useFootstepsProps) => {
  const previousFootRef = useRef<Foot | undefined>(undefined)
  const previousPhaseRef = useRef<number | undefined>(undefined)
  const [playerPosition] = useState<Vector3>(new Vector3(0, 0, 0))

  // Footsteps are locked to the locomotion animation phase (two footfalls per cycle), not wall-clock time.
  useFrame(({ scene }) => {
    const { footsteps, isClimbingLadder, movementSpeed, position } = movementController.getState()
    const { leftSound, rightSound } = footsteps

    const phase = animationController.getMovementAnimationPhase()

    if (
      phase === undefined ||
      !position.waypoints ||
      !footsteps.isActive ||
      isClimbingLadder ||
      !leftSound ||
      !rightSound
    ) {
      previousPhaseRef.current = phase
      return
    }

    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = phase
    if (previousPhase === undefined || !hasFootPlanted(previousPhase, phase)) {
      return
    }

    const camera = scene.getObjectByName('sceneCamera') as PerspectiveCamera
    const player = getPlayerEntity(scene)
    if (!player || !camera) {
      return
    }
    player.getWorldPosition(playerPosition)

    const foot = getNextFoot(previousFootRef.current)
    triggerFootstep({
      distanceToCamera: playerPosition.distanceTo(camera.position),
      foot,
      isWalking: movementSpeed < 2695,
      leftSound,
      rightSound,
    })
    previousFootRef.current = foot
  })
}

export default useFootsteps
