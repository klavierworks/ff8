import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'

import { WALKING_SPEED_LIMIT } from '../../../../../constants/speeds'
import { createAnimationController } from '../AnimationController/AnimationController'
import createFootstepController, { type Foot } from '../FootstepController/FootstepController'
import createMovementController from '../MovementController/MovementController'
import createSFXController from '../SFXController/SFXController'
import { calculateFootstepPan, calculateFootstepVolume, getNextFoot, hasFootPlanted } from './footsteps'

type useFootstepsProps = {
  animationController: ReturnType<typeof createAnimationController>
  footstepController: ReturnType<typeof createFootstepController>
  movementController: ReturnType<typeof createMovementController>
  sfxController: ReturnType<typeof createSFXController>
}

const useFootsteps = ({
  animationController,
  footstepController,
  movementController,
  sfxController,
}: useFootstepsProps) => {
  const previousFootRef = useRef<Foot | undefined>(undefined)
  const previousPhaseRef = useRef<number | undefined>(undefined)
  const [entityPosition] = useState<Vector3>(new Vector3(0, 0, 0))
  const [projectedPosition] = useState<Vector3>(new Vector3(0, 0, 0))

  // Footsteps are locked to the locomotion animation phase (two footfalls per cycle), not wall-clock time.
  useFrame(({ scene }) => {
    const { isClimbingLadder, movementSpeed, position } = movementController.getState()

    const phase = animationController.getMovementAnimationPhase()

    if (phase === undefined || !position.waypoints || !footstepController.getState().isActive || isClimbingLadder) {
      previousPhaseRef.current = phase
      return
    }

    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = phase
    if (previousPhase === undefined || !hasFootPlanted(previousPhase, phase)) {
      return
    }

    const camera = scene.getObjectByName('sceneCamera') as PerspectiveCamera
    if (!camera) {
      return
    }

    const { x, y, z } = movementController.getPosition()
    entityPosition.set(x, y, z)
    projectedPosition.copy(entityPosition).project(camera)

    const foot = getNextFoot(previousFootRef.current)
    previousFootRef.current = foot

    const { id, isFieldSound } = footstepController.getSoundForFoot(foot)
    const isWalking = movementSpeed < WALKING_SPEED_LIMIT
    const volume = calculateFootstepVolume(isWalking, entityPosition.distanceTo(camera.position))
    const pan = calculateFootstepPan(projectedPosition.x)

    if (isFieldSound) {
      sfxController.playFieldSound(id, 0, volume, pan)
      return
    }
    sfxController.play(id, 0, volume, pan)
  })
}

export default useFootsteps
