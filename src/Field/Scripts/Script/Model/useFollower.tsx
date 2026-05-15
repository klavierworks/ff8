import { useFrame } from '@react-three/fiber'
import { useCallback } from 'react'
import { Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import { getPartyMemberModelComponent, getPlayerEntity } from './modelUtils'

type UseFollowerProps = {
  isActive: boolean
  movementController: ReturnType<typeof createMovementController>
  partyMemberId: number | undefined
  rotationController: ReturnType<typeof createRotationController>
}

const DISTANCE = 40
const useFollower = ({ isActive, movementController, partyMemberId, rotationController }: UseFollowerProps) => {
  const moveToWaypoint = useCallback(
    (scene: Scene) => {
      if (!isActive || !movementController || !rotationController) {
        return
      }

      const { congaWaypointHistory, isUserControllable, party } = useGlobalStore.getState()

      const offset = party.findIndex((id) => id === partyMemberId)
      const history = congaWaypointHistory.at(-1 * offset * DISTANCE - 1)

      if (!isUserControllable) {
        if (congaWaypointHistory.length > 0) {
          useGlobalStore.setState({
            congaWaypointHistory: [],
          })
        }
        return
      }

      if (!history && !movementController.getState().hasBeenPlaced) {
        const leaderEntity = getPlayerEntity(scene)
        const thisMemberEntity = getPartyMemberModelComponent(scene, offset)
        if (!leaderEntity || !thisMemberEntity) {
          return
        }

        const leaderMovementController = leaderEntity.userData.movementController as ReturnType<
          typeof createMovementController
        >
        const leaderRotationController = leaderEntity.userData.rotationController as ReturnType<
          typeof createRotationController
        >
        const leaderPosition = leaderMovementController.getPosition()

        const walkmeshController = useGlobalStore.getState().walkmeshController!
        const position = walkmeshController.getNextPositionOnWalkmesh(
          new Vector3().copy(leaderPosition),
          leaderRotationController.getCurrentDirection().negate(),
          0.03,
        )
        movementController.setPosition(position)

        rotationController.turnToFaceAngle(leaderRotationController.getState().angle.get(), 0)

        return
      }

      if (!history) {
        return
      }

      const { angle, position, speed } = history

      if (position.equals(movementController.getPosition()) && angle === rotationController.getState().angle.get()) {
        return
      }

      rotationController.turnToFaceAngle(angle, 0)
      movementController.moveToPoint(position, {
        isAllowedToLeaveWalkmesh: true,
        userControlledSpeed: speed,
      })
    },
    [isActive, movementController, partyMemberId, rotationController],
  )

  useFrame((state) => {
    moveToWaypoint(state.scene)
  })
}

export default useFollower
