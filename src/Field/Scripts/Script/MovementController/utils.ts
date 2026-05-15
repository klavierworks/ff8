import { Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { createAnimationController } from '../AnimationController/AnimationController'
import createMovementController from './MovementController'

export const handleLadder = async (
  animationController: ReturnType<typeof createAnimationController>,
  movementController: ReturnType<typeof createMovementController>,
  middle: Vector3,
  end: Vector3,
  isUp: boolean,
) => {
  const hasStartedWithPlayerOnLadder = useGlobalStore.getState().isPlayerClimbingLadder
  console.log('Has started climbing ladder:', hasStartedWithPlayerOnLadder)
  console.log('isUp:', isUp)
  const startedClimbingOnFieldId = useGlobalStore.getState().fieldId
  movementController.setIsClimbingLadder(true)
  useGlobalStore.setState({ isPlayerClimbingLadder: true })

  const position = movementController.getPosition()

  const standingPosition = new Vector3(position.x, position.y, position.z)
  const startLadderClimbPosition = new Vector3(middle.x, middle.y, standingPosition.z)
  const endLadderClimbPosition = new Vector3(middle.x, middle.y, end.z)
  const finalStandingPosition = new Vector3(end.x, end.y, end.z)

  await movementController.moveToPoint(startLadderClimbPosition, {
    isAllowedToCrossBlockedTriangles: true,
    isAllowedToLeaveWalkmesh: true,
    isAnimationEnabled: false,
    isFacingTarget: false,
  })

  animationController.playLadderAnimation()
  await movementController.moveToPoint(endLadderClimbPosition, {
    isAllowedToCrossBlockedTriangles: true,
    isAllowedToLeaveWalkmesh: true,
    isAnimationEnabled: false,
    isClimbingLadder: true,
    isFacingTarget: false,
  })

  const checkIfIsStillOnMap = () =>
    useGlobalStore.getState().fieldId === startedClimbingOnFieldId && !useGlobalStore.getState().pendingFieldId

  if (!checkIfIsStillOnMap()) {
    return
  }

  await movementController.moveToPoint(finalStandingPosition, {
    isAllowedToCrossBlockedTriangles: true,
    isAllowedToLeaveWalkmesh: true,
    isAnimationEnabled: false,
    isFacingTarget: false,
  })

  if (!checkIfIsStillOnMap()) {
    return
  }

  animationController.stopLadderAnimation()

  useGlobalStore.setState({ isPlayerClimbingLadder: false })
  movementController.setIsClimbingLadder(false)
  animationController.playMovementAnimation('standing')
}
