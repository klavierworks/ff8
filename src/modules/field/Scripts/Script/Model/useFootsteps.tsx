import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'

import { createAnimationController } from '../AnimationController/AnimationController'
import createFootstepController from '../FootstepController/FootstepController'
import createMovementController from '../MovementController/MovementController'
import createSFXController from '../SFXController/SFXController'
import { calculateFootstepPan, calculateFootstepVolume, getPlantedFoot } from './footsteps'

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
  const previousPhaseRef = useRef<number | undefined>(undefined)
  const [entityPosition] = useState<Vector3>(new Vector3(0, 0, 0))
  const [viewPosition] = useState<Vector3>(new Vector3(0, 0, 0))
  const [projectedPosition] = useState<Vector3>(new Vector3(0, 0, 0))

  // Footsteps are locked to the locomotion animation phase (two footfalls per cycle), not wall-clock time.
  useFrame(({ scene }) => {
    const { isClimbingLadder } = movementController.getState()

    const phase = animationController.getLocomotionAnimationPhase()
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = phase

    if (phase === undefined || previousPhase === undefined || !animationController.isPlayingSteppingAnimation()) {
      return
    }

    if (!footstepController.getState().isActive) {
      return
    }

    const foot = getPlantedFoot(previousPhase, phase)
    if (!foot) {
      return
    }

    const camera = scene.getObjectByName('sceneCamera') as PerspectiveCamera
    if (!camera) {
      return
    }

    const { x, y, z } = movementController.getPosition()
    entityPosition.set(x, y, z)
    viewPosition.copy(entityPosition).applyMatrix4(camera.matrixWorldInverse)
    projectedPosition.copy(viewPosition).applyMatrix4(camera.projectionMatrix)

    const volume = calculateFootstepVolume(-viewPosition.z)
    const pan = calculateFootstepPan(projectedPosition.x)

    const { id, isFieldSound } = footstepController.getSoundForFoot(foot, isClimbingLadder)

    if (isFieldSound) {
      sfxController.playFieldSound(id, 0, volume, pan)
      return
    }
    sfxController.play(id, 0, volume, pan)
  })
}

export default useFootsteps
