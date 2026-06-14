import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { getPlayerEntity } from './Model/modelUtils'
import createMovementController from './MovementController/MovementController'

export type Side = 'LEFT' | 'RIGHT' | undefined

const DEFAULT_TRIGGER_RADIUS = 0.02

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
    distanceSquared: deltaX * deltaX + deltaY * deltaY,
    isInSegment: t >= 0 && t <= 1,
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
  radius: number = DEFAULT_TRIGGER_RADIUS,
) => {
  const hasInitializedRef = useRef(false)
  const wasInRangeRef = useRef(false)
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
    const side = getPointSideOfLine(line[0], line[1], playerPosition)
    if (!side) {
      return
    }

    const { distanceSquared, isInSegment } = getClosestPointOnSegmentXY(playerPosition, line[0], line[1])
    const isInRange = isInSegment && distanceSquared <= radius * radius

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      wasInRangeRef.current = isInRange
      onInitialized?.(side)
      return
    }

    if (isInRange === wasInRangeRef.current) {
      return
    }
    wasInRangeRef.current = isInRange

    if (isInRange) {
      onTouchOn?.(side)
      onAcross?.()
      return
    }
    onTouchOff?.(side)
  })
}

export default useIntersection
