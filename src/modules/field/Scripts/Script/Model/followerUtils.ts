import { Vector3 } from 'three'

import type WalkmeshMovementController from '../../../WalkMesh/WalkmeshMovement'

const WALK_MOVEMENT_SPEED = 2560

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
    const next = walkmeshController.getNextPositionOnWalkmesh(position, behindDirection, stepDistance, triangle)
    history.unshift({
      angle: leaderAngle,
      isClimbingLadder: false,
      position: next.clone(),
      speed: WALK_MOVEMENT_SPEED,
    })
    position.copy(next)

    if (triangle === undefined) {
      triangle = walkmeshController.getTriangleForPosition(position) ?? undefined
      continue
    }
    const permittedTriangles = [triangle, ...walkmeshController.getAdjacentTriangles(triangle)]
    triangle = walkmeshController.getTriangleForPosition(position, permittedTriangles, false) ?? triangle
  }

  return history
}
