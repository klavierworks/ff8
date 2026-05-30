import { useFrame } from '@react-three/fiber'
import { useCallback } from 'react'
import { Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import { buildCongaSeedHistory } from './followerUtils'
import { getPlayerEntity } from './modelUtils'
import { SPEED } from './useControls'

type UseFollowerProps = {
  isActive: boolean
  movementController: ReturnType<typeof createMovementController>
  partyMemberId: number | undefined
  rotationController: ReturnType<typeof createRotationController>
}

const DISTANCE = 40

const useFollower = ({ isActive, movementController, partyMemberId, rotationController }: UseFollowerProps) => {
  const seedCongaHistory = useCallback((scene: Scene, party: number[], delta: number) => {
    const leaderEntity = getPlayerEntity(scene)
    if (!leaderEntity) {
      return
    }

    const leaderMovementController = leaderEntity.userData.movementController as ReturnType<
      typeof createMovementController
    >
    const leaderRotationController = leaderEntity.userData.rotationController as ReturnType<
      typeof createRotationController
    >
    if (!leaderMovementController?.getState().hasBeenPlaced) {
      return
    }

    const walkmeshController = useGlobalStore.getState().walkmeshController
    if (!walkmeshController) {
      return
    }

    const leaderPosition = leaderMovementController.getPosition()
    const leaderAngle = leaderRotationController.getState().angle.get()
    const behindDirection = leaderRotationController.getCurrentDirection().negate()
    const leaderTriangle = leaderMovementController.getState().position.walkmeshTriangle ?? undefined
    const maxFollowerOffset = Math.max(0, party.length - 1)

    const seed = buildCongaSeedHistory(
      new Vector3(leaderPosition.x, leaderPosition.y, leaderPosition.z),
      leaderAngle,
      behindDirection,
      walkmeshController,
      maxFollowerOffset * DISTANCE + 1,
      SPEED.WALKING * delta,
      leaderTriangle,
    )

    useGlobalStore.setState((state) => {
      if (state.congaWaypointHistory.length > 0) {
        return state
      }
      return { congaWaypointHistory: seed }
    })
  }, [])

  const moveToWaypoint = useCallback(
    (scene: Scene, delta: number) => {
      if (!isActive || !movementController || !rotationController) {
        return
      }

      const { congaWaypointHistory, isUserControllable, party } = useGlobalStore.getState()

      if (!isUserControllable) {
        if (congaWaypointHistory.length > 0) {
          useGlobalStore.setState({
            congaWaypointHistory: [],
          })
        }
        return
      }

      if (congaWaypointHistory.length === 0) {
        seedCongaHistory(scene, party, delta)
        return
      }

      const offset = party.findIndex((id) => id === partyMemberId)
      const history = congaWaypointHistory.at(-1 * offset * DISTANCE - 1)
      if (!history) {
        return
      }

      const { angle, position, speed } = history

      if (!movementController.getState().hasBeenPlaced) {
        movementController.setPosition(position)
        rotationController.turnToFaceAngle(angle, 0)
        return
      }

      if (position.equals(movementController.getPosition()) && angle === rotationController.getState().angle.get()) {
        return
      }

      rotationController.turnToFaceAngle(angle, 0)
      movementController.moveToPoint(position, {
        isAllowedToLeaveWalkmesh: true,
        userControlledSpeed: speed,
      })
    },
    [isActive, movementController, partyMemberId, rotationController, seedCongaHistory],
  )

  useFrame((state, delta) => {
    moveToWaypoint(state.scene, delta)
  })
}

export default useFollower
