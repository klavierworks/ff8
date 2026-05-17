import { useFrame } from '@react-three/fiber'
import { RefObject, useRef, useState } from 'react'
import { Object3D, Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { getPlayerEntity } from './Model/modelUtils'
import createMovementController from './MovementController/MovementController'

export type STATES = 'LEFT' | 'RIGHT' | undefined

const getPointSideOfLine = (lineStart: VectorLike, lineEnd: VectorLike, point: Vector3): STATES => {
  const lineDirection = new Vector3().subVectors(lineEnd, lineStart)
  const pointVector = new Vector3().subVectors(point, lineStart)
  const cross = new Vector3().crossVectors(lineDirection, pointVector)

  if (cross.z > 0) {
    return 'LEFT'
  } else if (cross.z < 0) {
    return 'RIGHT'
  }
}

const segmentsCrossInXY = (
  p1: VectorLike, p2: VectorLike,
  q1: VectorLike, q2: VectorLike,
): boolean => {
  const d1x = p2.x - p1.x
  const d1y = p2.y - p1.y
  const d2x = q2.x - q1.x
  const d2y = q2.y - q1.y
  const denom = d1x * d2y - d1y * d2x
  if (denom === 0) return false
  const dx = q1.x - p1.x
  const dy = q1.y - p1.y
  const t = (dx * d2y - dy * d2x) / denom
  const s = (dx * d1y - dy * d1x) / denom
  return t >= 0 && t <= 1 && s >= 0 && s <= 1
}

const useIntersection = (
  _targetMeshRef: RefObject<null | Object3D>,
  isActive = true,
  {
    onAcross,
    onInitialized,
    onTouchOff,
    onTouchOn,
  }: {
    onAcross?: () => void
    onInitialized?: (spawnSide: STATES) => void
    onTouchOff?: (side: STATES) => void
    onTouchOn?: (fromSide: STATES) => void
  },
  line: VectorLike[],
) => {
  const currentStateRef = useRef<STATES>(undefined)
  const [playerPosition] = useState(new Vector3())
  const [previousPosition] = useState(new Vector3())
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
    const { hasBeenPlaced, hasMoved } = movementController.getState()

    if (!hasBeenPlaced) {
      return
    }

    player.getWorldPosition(playerPosition)
    const side = getPointSideOfLine(line[0], line[1], playerPosition)

    // Capture spawn side before first movement. cross.z === 0 is practically
    // impossible with floating point, but skip that frame if it happens.
    if (currentStateRef.current === undefined) {
      if (!side) return
      currentStateRef.current = side
      previousPosition.copy(playerPosition)
      onInitialized?.(side)
      return
    }

    if (!hasMoved) {
      previousPosition.copy(playerPosition)
      return
    }

    if (side && side !== currentStateRef.current) {
      if (segmentsCrossInXY(previousPosition, playerPosition, line[0], line[1])) {
        onTouchOn?.(currentStateRef.current)
        onTouchOff?.(side)
        onAcross?.()
      }
      currentStateRef.current = side
    }

    previousPosition.copy(playerPosition)
  })
}

export default useIntersection
