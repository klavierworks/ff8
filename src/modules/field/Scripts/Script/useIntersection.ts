import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Object3D, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { numberToFloatingPoint } from '../../../../utils'
import { getPlayerEntity } from './Model/modelUtils'
import createMovementController from './MovementController/MovementController'
import createRotationController from './RotationController/RotationController'
import { ScriptStateStore } from './state'

export type Side = 'LEFT' | 'RIGHT' | undefined

const _closestPoint = new Vector3()

const getPointSideOfLine = (lineStart: VectorLike, lineEnd: VectorLike, point: VectorLike): Side => {
  const crossZ =
    (lineEnd.x - lineStart.x) * (point.y - lineStart.y) - (lineEnd.y - lineStart.y) * (point.x - lineStart.x)
  if (crossZ > 0) {
    return 'LEFT'
  }
  if (crossZ < 0) {
    return 'RIGHT'
  }
}

const getClosestPointOnSegmentXY = (point: VectorLike, segmentStart: VectorLike, segmentEnd: VectorLike) => {
  const segmentX = segmentEnd.x - segmentStart.x
  const segmentY = segmentEnd.y - segmentStart.y
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
  let t = 0
  if (segmentLengthSquared > 0) {
    t = ((point.x - segmentStart.x) * segmentX + (point.y - segmentStart.y) * segmentY) / segmentLengthSquared
  }
  const clamped = Math.max(0, Math.min(1, t))
  const closestX = segmentStart.x + clamped * segmentX
  const closestY = segmentStart.y + clamped * segmentY
  const deltaX = point.x - closestX
  const deltaY = point.y - closestY
  return {
    closestPoint: _closestPoint.set(closestX, closestY, 0),
    distanceSquared: deltaX * deltaX + deltaY * deltaY,
    isInSegment: t >= 0 && t <= 1,
  }
}

const getTriggerRadius = (player: Object3D) => {
  const useScriptStateStore = player.userData.useScriptStateStore as ScriptStateStore | undefined

  return numberToFloatingPoint(useScriptStateStore?.getState().pushRadius ?? 0)
}

const isPlayerFacingPoint = (player: Object3D, playerPosition: VectorLike, point: VectorLike) => {
  const towardsX = point.x - playerPosition.x
  const towardsY = point.y - playerPosition.y
  if (towardsX === 0 && towardsY === 0) {
    return true
  }

  const rotationController = player.userData.rotationController as ReturnType<typeof createRotationController>
  const facingDirection = rotationController.getCurrentDirection()

  return facingDirection.x * towardsX + facingDirection.y * towardsY > 0
}

const getIntersectionState = (
  player: Object3D,
  playerPosition: Vector3,
  line: VectorLike[],
  shouldRequireFacing: boolean,
) => {
  const { closestPoint, distanceSquared, isInSegment } = getClosestPointOnSegmentXY(playerPosition, line[0], line[1])
  const triggerRadius = getTriggerRadius(player)
  const isInRange = isInSegment && distanceSquared < triggerRadius * triggerRadius

  return {
    isInRange,
    isTouching: isInRange && (!shouldRequireFacing || isPlayerFacingPoint(player, playerPosition, closestPoint)),
    side: getPointSideOfLine(line[0], line[1], playerPosition),
  }
}

const useIntersection = (
  isActive = true,
  {
    onAcross,
    onInitialized,
    onTouchOff,
    onTouchOn,
  }: {
    onAcross?: () => void
    onInitialized?: (spawnSide: Side) => void
    onTouchOff?: (side: Side) => void
    onTouchOn?: (fromSide: Side) => void
  },
  line: VectorLike[],
  { shouldRequireFacing = false }: { shouldRequireFacing?: boolean } = {},
) => {
  const hasInitializedRef = useRef(false)
  const wasInRangeRef = useRef(false)
  const wasTouchingRef = useRef(false)
  const [playerPosition] = useState(new Vector3())
  const isUserControllable = useGlobalStore((state) => state.isUserControllable)

  useFrame(({ scene }) => {
    if (!isActive || !isUserControllable || !line?.[0] || !line?.[1]) {
      return
    }

    const player = getPlayerEntity(scene)
    if (!player) {
      return
    }

    const movementController = player.userData.movementController as ReturnType<typeof createMovementController>
    const { hasBeenPlaced } = movementController.getState()
    if (!hasBeenPlaced) {
      return
    }

    player.getWorldPosition(playerPosition)
    const { isInRange, isTouching, side } = getIntersectionState(player, playerPosition, line, shouldRequireFacing)
    if (!side) {
      return
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      wasInRangeRef.current = isInRange
      wasTouchingRef.current = isTouching
      onInitialized?.(side)
      return
    }

    if (isTouching !== wasTouchingRef.current) {
      wasTouchingRef.current = isTouching
      if (isTouching) {
        onTouchOn?.(side)
      } else {
        onTouchOff?.(side)
      }
    }

    if (isInRange !== wasInRangeRef.current) {
      wasInRangeRef.current = isInRange
      if (isInRange) {
        onAcross?.()
      }
    }
  })
}

export default useIntersection
