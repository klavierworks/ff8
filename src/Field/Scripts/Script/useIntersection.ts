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
      onInitialized?.(side)
      return
    }

    if (!hasMoved) {
      return
    }

    if (side && side !== currentStateRef.current) {
      onTouchOn?.(currentStateRef.current)
      onTouchOff?.(side)
      onAcross?.()
      currentStateRef.current = side
    }
  })
}

export default useIntersection
