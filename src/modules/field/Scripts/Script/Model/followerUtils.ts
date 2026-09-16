import { Vector3 } from 'three'

import type WalkmeshMovementController from '../../../WalkMesh/WalkmeshMovement'

import { LADDER_TRAIL_DELAY_FRAMES, LADDER_TRAIL_STRETCH } from '../../../../../constants/ladders'

export const WALK_MOVEMENT_SPEED = 2560

export const CONGA_FOLLOWER_DELAY = 40

export const CONGA_HISTORY_LENGTH = Math.ceil(2 * CONGA_FOLLOWER_DELAY * LADDER_TRAIL_STRETCH) + 2

// The original eases each follower's trail delay by one 30 Hz frame per frame
// until it reaches its target, so the whole conga line stretches and closes at
// one rate however far back a member sits.
const CONGA_DELAY_STEP = CONGA_FOLLOWER_DELAY / LADDER_TRAIL_DELAY_FRAMES

export const getCongaTrailDelay = (partySlot: number, isStretched: boolean) =>
  partySlot * CONGA_FOLLOWER_DELAY * (isStretched ? LADDER_TRAIL_STRETCH : 1)

export const easeCongaTrailDelay = (current: number, target: number, elapsedFrames: number) => {
  const step = CONGA_DELAY_STEP * elapsedFrames
  if (target > current) {
    return Math.min(target, current + step)
  }
  return Math.max(target, current - step)
}

export const buildCongaSeedHistory = (
  leaderPosition: Vector3,
  leaderAngle: number,
  behindDirection: Vector3,
  walkmeshController: WalkmeshMovementController,
  stepCount: number,
  stepDistance: number,
  startTriangle?: number,
): CongaHistory[] => {
  const history: CongaHistory[] = []
  const position = leaderPosition.clone()
  let triangle = startTriangle ?? walkmeshController.getTriangleForPosition(position) ?? undefined

  for (let step = 0; step < stepCount; step++) {
    const next = walkmeshController.getNextPositionOnWalkmesh(position, behindDirection, stepDistance, {
      triangleId: triangle,
    })
    history.unshift({
      angle: leaderAngle,
      isClimbingLadder: false,
      position: next.position.clone(),
      speed: WALK_MOVEMENT_SPEED,
    })
    position.copy(next.position)
    triangle = next.triangleId ?? triangle
  }

  return history
}
