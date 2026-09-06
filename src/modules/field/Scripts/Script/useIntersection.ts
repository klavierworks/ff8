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

type IntersectionHandlers = {
  onAcross?: (side: Side) => void
  onFacing?: () => void
  onInitialized?: (spawnSide: Side) => void
  onRange?: () => void
  onTouchOff?: (side: Side) => void
  onTouchOn?: (fromSide: Side) => void
}

type IntersectionState = {
  isFacing: boolean
  isInRange: boolean
  isWithinInteractCone: boolean
}

const INTERACT_CONE_COSINE = Math.cos(Math.PI / 4)

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

const getFacingCosine = (player: Object3D, playerPosition: VectorLike, point: VectorLike) => {
  const towardsX = point.x - playerPosition.x
  const towardsY = point.y - playerPosition.y
  const length = Math.hypot(towardsX, towardsY)
  if (length === 0) {
    return 1
  }

  const rotationController = player.userData.rotationController as ReturnType<typeof createRotationController>
  const facingDirection = rotationController.getCurrentDirection()

  return (facingDirection.x * towardsX + facingDirection.y * towardsY) / length
}

const getIntersectionState = (player: Object3D, playerPosition: Vector3, line: VectorLike[]) => {
  const { closestPoint, distanceSquared, isInSegment } = getClosestPointOnSegmentXY(playerPosition, line[0], line[1])
  const triggerRadius = getTriggerRadius(player)
  const isInRange = isInSegment && distanceSquared < triggerRadius * triggerRadius
  const facingCosine = isInRange ? getFacingCosine(player, playerPosition, closestPoint) : -1

  return {
    isFacing: facingCosine > 0,
    isInRange,
    isWithinInteractCone: facingCosine > INTERACT_CONE_COSINE,
    side: getPointSideOfLine(line[0], line[1], playerPosition),
  }
}

const useIntersection = (
  isActive = true,
  { onAcross, onFacing, onInitialized, onRange, onTouchOff, onTouchOn }: IntersectionHandlers,
  line: VectorLike[],
  { shouldRequireFacing = false }: { shouldRequireFacing?: boolean } = {},
) => {
  const hasInitializedRef = useRef(false)
  const wasTouchingRef = useRef(false)
  const previousSideRef = useRef<Side>(undefined)
  const stateRef = useRef<IntersectionState>({ isFacing: false, isInRange: false, isWithinInteractCone: false })
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
    const { isFacing, isInRange, isWithinInteractCone, side } = getIntersectionState(player, playerPosition, line)
    if (!side) {
      return
    }

    const isTouching = shouldRequireFacing ? isFacing : isInRange
    const wasTouching = wasTouchingRef.current
    const previousSide = previousSideRef.current
    stateRef.current = { isFacing, isInRange, isWithinInteractCone }
    wasTouchingRef.current = isTouching
    previousSideRef.current = side

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      onInitialized?.(side)
      return
    }

    if (isTouching !== wasTouching) {
      if (isTouching) {
        onTouchOn?.(side)
      } else {
        onTouchOff?.(side)
      }
    }

    if (!isInRange) {
      return
    }

    if (side !== previousSide) {
      onAcross?.(side)
    }
    if (isFacing) {
      onFacing?.()
    }
    onRange?.()
  })

  return stateRef
}

export default useIntersection
