import { Vector3 } from 'three'

import {
  LADDER_DOWN_MASK,
  LADDER_MOUNT_TRIM_FRAMES,
  LADDER_SETTLE_FRAMES,
  LADDER_STRICT_DOWN_MASK,
  LADDER_STRICT_UP_MASK,
  LADDER_UP_MASK,
} from '../../../../../constants/ladders'
import useGlobalStore from '../../../../../store'
import { floatingPointToNumber } from '../../../../../utils'
import { nextScriptFrame } from '../../../scriptClock'
import { createAnimationController } from '../AnimationController/AnimationController'
import { isKeyDown } from '../common'
import createMovementController from './MovementController'

type AnimationController = ReturnType<typeof createAnimationController>
type LadderClimb = {
  approach: Vector3
  exit: Vector3
  isPlayerDriven: boolean
  isUp: boolean
  target: Vector3
}

type LadderMove = {
  animationId: number
  isPlayerDriven: boolean
  isUp: boolean
  target: Vector3
}

type MovementController = ReturnType<typeof createMovementController>

export const getIsLadderPlayerDriven = (partyMemberId: number | undefined) => {
  const { isUserControllable, party } = useGlobalStore.getState()
  return isUserControllable && partyMemberId !== undefined && party[0] === partyMemberId
}

// Backing off the ladder wins over climbing when both are held, as in the
// original's nested pad test.
const getPadDirection = (advanceMask: number, retreatMask: number) => {
  if (isKeyDown(retreatMask)) {
    return -1
  }
  return isKeyDown(advanceMask) ? 1 : 0
}

const getClimbFrameCount = (from: Vector3, to: Vector3) => {
  const fieldDistance = floatingPointToNumber(from.distanceTo(to))
  return Math.trunc((fieldDistance * 4) / useGlobalStore.getState().ladderClimbSpeed)
}

const getMountFrameCount = (animationController: AnimationController, animationId: number) =>
  Math.max(0, animationController.getAnimationFrameCount(animationId) - LADDER_MOUNT_TRIM_FRAMES)

// The pause at the top is how long the party is given to close the gap the
// climb opened, so it scales with the number of followers.
const getSettleFrameCount = () => {
  const { party, partyMembersFollowing } = useGlobalStore.getState()
  const followerCount = party.filter((member, index) => index > 0 && partyMembersFollowing.includes(member)).length
  return LADDER_SETTLE_FRAMES[Math.min(followerCount, LADDER_SETTLE_FRAMES.length - 1)]
}

const getIsStillOnField = (fieldId: string | undefined) => {
  const { fieldId: currentFieldId, pendingFieldId } = useGlobalStore.getState()
  return currentFieldId === fieldId && !pendingFieldId
}

const createClimbAnimationSync = (animationController: AnimationController, climbAnimationId: number) => {
  let playedDirection = 0

  return (direction: number) => {
    animationController.pauseAnimation(direction === 0)
    if (direction === 0 || direction === playedDirection) {
      return
    }
    playedDirection = direction
    animationController.playLadderAnimation(climbAnimationId, direction, true)
  }
}

// The segment is stepped in MovementController.tick at render cadence, but the
// script waits on it a frame at a time so that a field teardown — which
// releases every script waiter — unwinds a ladder in progress instead of
// leaving the opcode pending forever.
const awaitLadderSegment = async (movementController: MovementController, fieldId: string | undefined) => {
  while (movementController.getLadderResult() === undefined && getIsStillOnField(fieldId)) {
    await nextScriptFrame()
  }
  return movementController.getLadderResult() ?? 'completed'
}

const climbBetweenAnchors = (
  animationController: AnimationController,
  movementController: MovementController,
  from: Vector3,
  to: Vector3,
  climbAnimationId: number,
  getDirection: (() => number) | undefined,
  fieldId: string | undefined,
) => {
  movementController.moveAlongLadder(from, to, getClimbFrameCount(from, to), {
    getDirection,
    onDirectionChange: createClimbAnimationSync(animationController, climbAnimationId),
  })
  return awaitLadderSegment(movementController, fieldId)
}

const runLadderPhases = async (
  animationController: AnimationController,
  movementController: MovementController,
  { approach, exit, isPlayerDriven, isUp, target }: LadderClimb,
) => {
  const fieldId = useGlobalStore.getState().fieldId
  const { ladderBottomId, ladderClimbId, ladderTopId } = animationController.getSavedAnimation()

  const mountAnimationId = isUp ? ladderBottomId : ladderTopId
  const dismountAnimationId = isUp ? ladderTopId : ladderBottomId
  const ladderDirection = isUp ? 1 : -1
  const advanceMask = isUp ? LADDER_UP_MASK : LADDER_DOWN_MASK
  const retreatMask = isUp ? LADDER_DOWN_MASK : LADDER_UP_MASK
  const standingPosition = movementController.getState().position.current.clone()

  animationController.playLadderAnimation(mountAnimationId, ladderDirection, false)
  movementController.moveAlongLadder(
    standingPosition,
    approach,
    getMountFrameCount(animationController, mountAnimationId),
  )
  await awaitLadderSegment(movementController, fieldId)
  if (!getIsStillOnField(fieldId)) {
    return
  }

  const climbResult = await climbBetweenAnchors(
    animationController,
    movementController,
    approach,
    exit,
    ladderClimbId,
    isPlayerDriven ? () => getPadDirection(advanceMask, retreatMask) : undefined,
    fieldId,
  )
  if (!getIsStillOnField(fieldId)) {
    return
  }

  if (climbResult === 'reversed') {
    animationController.playLadderAnimation(mountAnimationId, -ladderDirection, false)
    movementController.moveAlongLadder(
      approach,
      standingPosition,
      getMountFrameCount(animationController, mountAnimationId),
    )
  } else {
    animationController.playLadderAnimation(dismountAnimationId, ladderDirection, false)
    movementController.moveAlongLadder(exit, target, getMountFrameCount(animationController, dismountAnimationId))
  }
  await awaitLadderSegment(movementController, fieldId)
  if (!getIsStillOnField(fieldId)) {
    return
  }

  // The settle exists purely so the line can close the gap the climb opened, so
  // the stretched delays are released as it starts, not when the opcode ends.
  const settlePosition = movementController.getState().position.current.clone()
  useGlobalStore.setState({ isCongaTrailStretched: false })
  animationController.playMovementAnimation('standing')
  movementController.moveAlongLadder(settlePosition, settlePosition, getSettleFrameCount())
  await awaitLadderSegment(movementController, fieldId)
}

// Whatever happens in the phases, the entity has to come off the ladder: a
// climb left latched leaves the triggering script's method pending forever.
const releaseLadder = (animationController: AnimationController, movementController: MovementController) => {
  animationController.pauseAnimation(false)
  animationController.stopLadderAnimation()
  movementController.refreshWalkmeshTriangle()
  movementController.setIsClimbingLadder(false)
  animationController.playMovementAnimation('standing')
}

export const handleLadder = async (
  animationController: AnimationController,
  movementController: MovementController,
  climb: LadderClimb,
) => {
  movementController.setIsClimbingLadder(true)
  useGlobalStore.setState({ isCongaTrailStretched: true, isPlayerClimbingLadder: true })

  try {
    await runLadderPhases(animationController, movementController, climb)
  } finally {
    releaseLadder(animationController, movementController)
    useGlobalStore.setState({ isCongaTrailStretched: false, isPlayerClimbingLadder: false })
  }
}

// The param-carrying forms are a single interpolation from wherever the entity
// stands to the target, with no approach, dismount or settle phase, and they
// never feed the party trail.
export const handleDirectLadder = async (
  animationController: AnimationController,
  movementController: MovementController,
  { animationId, isPlayerDriven, isUp, target }: LadderMove,
) => {
  movementController.setIsClimbingLadder(true)

  const fieldId = useGlobalStore.getState().fieldId
  const start = movementController.getState().position.current.clone()
  const advanceMask = isUp ? LADDER_STRICT_UP_MASK : LADDER_STRICT_DOWN_MASK
  const retreatMask = isUp ? LADDER_DOWN_MASK : LADDER_UP_MASK

  try {
    await climbBetweenAnchors(
      animationController,
      movementController,
      start,
      target,
      animationId,
      isPlayerDriven ? () => getPadDirection(advanceMask, retreatMask) : undefined,
      fieldId,
    )
  } finally {
    releaseLadder(animationController, movementController)
  }
}
