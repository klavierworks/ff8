import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Object3D, PerspectiveCamera, Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import { checkForIntersections } from '../../../../../utils'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import { convert256ToRadians } from '../utils'
import { getPlayerEntity } from './modelUtils'
import useKeyboardControls from './useKeyboardControls'

export const SPEED = {
  RUNNING: 0.175,
  WALKING: 0.08,
}

const COLLIDABLE_REFRESH_FRAMES = 30

type useControlsProps = {
  characterHeight: number
  isActive: boolean
  movementController: ReturnType<typeof createMovementController>
  rotationController: ReturnType<typeof createRotationController>
}

const desiredPosition = new Vector3(0, 0, 0)

const useControls = ({ characterHeight, isActive, movementController, rotationController }: useControlsProps) => {
  const isRunEnabled = useGlobalStore((state) => state.isRunEnabled)

  const movementFlags = useKeyboardControls()

  const [hasPlacedCharacter, setHasPlacedCharacter] = useState(false)

  const isUserControllable = useGlobalStore((state) => state.isUserControllable)
  const initialFieldPosition = useGlobalStore((state) => state.characterPosition)
  const isTransitioningMap = useGlobalStore((state) => !!state.pendingFieldId)
  const walkmeshController = useGlobalStore((state) => state.walkmeshController)

  useEffect(() => {
    if (movementController.getState().footsteps.leftSound) {
      return
    }

    movementController.setFootsteps()
  }, [movementController])

  const characterHeightRef = useRef(characterHeight)
  useEffect(() => {
    characterHeightRef.current = characterHeight
  }, [characterHeight])

  useEffect(() => {
    if (!isActive) {
      return
    }
    if (!walkmeshController || !initialFieldPosition || isTransitioningMap) {
      return
    }

    const initialPosition = new Vector3(initialFieldPosition.x, initialFieldPosition.y, initialFieldPosition.z)
    const newPosition = walkmeshController.getPositionOnWalkmesh(initialPosition)
    console.log('Placing character at', newPosition, 'from initial position', initialPosition)
    if (newPosition) {
      movementController.setPosition(newPosition)
    } else {
      console.error('Tried to set character position to an invalid position', initialPosition)
    }

    setHasPlacedCharacter(true)
    return () => {
      setHasPlacedCharacter(false)
    }
  }, [
    initialFieldPosition,
    isTransitioningMap,
    setHasPlacedCharacter,
    movementController,
    walkmeshController,
    isActive,
  ])

  const controlDirection = useGlobalStore((state) => state.fieldDirection)

  const handleMovement = useCallback(() => {
    let x = 0
    let y = 0

    if (movementFlags.forward) {
      y += 1
    }
    if (movementFlags.backward) {
      y -= 1
    }
    if (movementFlags.right) {
      x -= 1
    }
    if (movementFlags.left) {
      x += 1
    }

    if (x === 0 && y === 0) {
      return null
    }

    const radians = Math.atan2(x, y)

    const angle = Math.round((radians / Math.PI) * 128) - 128 + 256

    return angle + (controlDirection - 128)
  }, [movementFlags, controlDirection])

  const [forwardDirection] = useState(new Vector3(0, -1, 0))
  const [upDirection] = useState(new Vector3(0, 0, 1))
  const [POSITION_VECTOR] = useState(new Vector3())

  const collidableCandidates = useRef<Object3D[]>([])
  const collidableRefreshCounter = useRef(0)
  const getCollidableBlockages = useCallback((scene: Scene) => {
    collidableRefreshCounter.current -= 1
    if (collidableRefreshCounter.current <= 0 || collidableCandidates.current.length === 0) {
      collidableRefreshCounter.current = COLLIDABLE_REFRESH_FRAMES
      const candidates: Object3D[] = []
      scene.traverse((object) => {
        if ('isSolid' in object.userData) {
          candidates.push(object)
        }
      })
      collidableCandidates.current = candidates
    }
    return collidableCandidates.current.filter((object) => object.parent !== null && object.userData.isSolid)
  }, [])
  const handleFrame = useCallback(
    async (camera: PerspectiveCamera, scene: Scene, delta: number) => {
      if (!isActive || !isUserControllable || !hasPlacedCharacter || isTransitioningMap) {
        return
      }

      const { isPaused, userControlledSpeed, waypoints } = movementController.getState().position
      if (waypoints && userControlledSpeed !== undefined && !isPaused) {
        return
      }

      const player = getPlayerEntity(scene)
      if (!player) {
        console.warn('No player entity found in scene')
        return
      }

      const isTurning = rotationController.getState().angle.isAnimating
      if (!walkmeshController || !isUserControllable || isTurning) {
        return
      }
      const movementAngle = handleMovement()
      if (movementAngle === null) {
        return
      }

      rotationController.turnToFaceAngle(movementAngle, 0)

      const isWalking = !isRunEnabled || movementFlags.isWalking
      const speed = isWalking ? SPEED.WALKING : SPEED.RUNNING

      const currentPosition = movementController.getPosition()
      if (!currentPosition) {
        return
      }

      upDirection.set(0, 0, 1)
      const meshUp = upDirection.applyQuaternion(player.quaternion).normalize()

      forwardDirection.set(0, -1, 0)
      const meshForward = forwardDirection.applyAxisAngle(meshUp, convert256ToRadians(movementAngle)).normalize()

      const moveDistance = speed * delta
      desiredPosition.copy(currentPosition).add(meshForward.multiplyScalar(moveDistance))

      const newPosition = walkmeshController.getNextPositionOnWalkmesh(
        POSITION_VECTOR.set(currentPosition.x, currentPosition.y, currentPosition.z),
        meshForward,
        moveDistance,
        movementController.getState().position.walkmeshTriangle ?? undefined,
      )

      if (!newPosition) {
        return
      }

      const blockages = getCollidableBlockages(scene)

      const isPermitted = checkForIntersections(player, newPosition, blockages, camera)
      if (!isPermitted) {
        return
      }

      movementController.setPosition(newPosition)
      movementController.setHasMoved(true)

      const movementSpeed = isWalking ? 2560 : 7929
      return [newPosition, movementSpeed]
    },
    [
      isActive,
      isUserControllable,
      hasPlacedCharacter,
      isTransitioningMap,
      movementController,
      rotationController,
      walkmeshController,
      handleMovement,
      isRunEnabled,
      movementFlags.isWalking,
      upDirection,
      forwardDirection,
      POSITION_VECTOR,
      getCollidableBlockages,
    ],
  )

  const handleUpdateCongaWaypoint = useCallback(
    (newPosition: null | Vector3, movementSpeed: number) => {
      const isClimbingLadder = movementController.getState().isClimbingLadder

      if (!newPosition) {
        return
      }
      useGlobalStore.setState((state) => {
        state.hasMoved = true

        state.congaWaypointHistory.push({
          angle: rotationController.getState().angle.get(),
          isClimbingLadder,
          position: newPosition.clone(),
          speed: movementSpeed,
        })
        if (state.congaWaypointHistory.length > 100) {
          state.congaWaypointHistory.shift()
        }
        return state
      })
    },
    [movementController, rotationController],
  )

  useFrame(({ scene }, delta) => {
    if (!isActive) {
      return
    }

    if (!movementController.getState().hasBeenPlaced) {
      return
    }

    const isClimbingLadder = movementController.getState().isClimbingLadder

    if (isClimbingLadder) {
      return
    }
    const camera = scene.getObjectByName('sceneCamera') as PerspectiveCamera
    handleFrame(camera as PerspectiveCamera, scene, delta).then((returnedValue) => {
      const [newPosition, movementSpeed] = (returnedValue ?? [null, 0]) as [null | Vector3, number]
      movementController.setUserControlledSpeed(movementSpeed > 0 ? movementSpeed : undefined)
      handleUpdateCongaWaypoint(newPosition, movementSpeed)
    })
  })
}

export default useControls
