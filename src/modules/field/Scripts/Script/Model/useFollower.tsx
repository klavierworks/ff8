import { useFrame } from '@react-three/fiber'
import { useCallback, useRef } from 'react'
import { Scene, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import { TARGET_FPS } from '../../../../../timing'
import { createAnimationController } from '../AnimationController/AnimationController'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import { buildCongaSeedHistory, CONGA_FOLLOWER_DELAY, easeCongaTrailDelay, getCongaTrailDelay } from './followerUtils'
import { getPlayerEntity } from './modelUtils'
import { SPEED } from './useControls'

type UseFollowerProps = {
  animationController: ReturnType<typeof createAnimationController>
  isActive: boolean
  movementController: ReturnType<typeof createMovementController>
  partyMemberId: number | undefined
  rotationController: ReturnType<typeof createRotationController>
}

const useFollower = ({
  animationController,
  isActive,
  movementController,
  partyMemberId,
  rotationController,
}: UseFollowerProps) => {
  const trailDelayRef = useRef<number | undefined>(undefined)
  const trailHeadRef = useRef<number | undefined>(undefined)
  const ladderAnimationRef = useRef<string | undefined>(undefined)

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
      maxFollowerOffset * CONGA_FOLLOWER_DELAY + 1,
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

  // A follower's ladder animation is stepped by the trail, not by wall clock —
  // the original only animates it on frames that advanced the write head, so a
  // leader hanging on the ladder leaves the line frozen mid-pose behind them.
  const replayLadderWaypoint = useCallback(
    ({ angle, ladderAnimation, position }: CongaHistory, hasTrailAdvanced: boolean) => {
      movementController.setIsClimbingLadder(true)
      movementController.setLadderPosition(position)
      animationController.pauseAnimation(!hasTrailAdvanced)

      if (angle !== rotationController.getState().angle.get()) {
        rotationController.turnToFaceAngle(angle, 0)
      }

      const animationKey = ladderAnimation ? `${ladderAnimation.id}:${ladderAnimation.direction}` : 'standing'
      if (animationKey === ladderAnimationRef.current) {
        return
      }
      ladderAnimationRef.current = animationKey

      if (!ladderAnimation) {
        animationController.playMovementAnimation('standing')
        return
      }
      animationController.playLadderAnimation(ladderAnimation.id, ladderAnimation.direction, true)
    },
    [animationController, movementController, rotationController],
  )

  const moveToWaypoint = useCallback(
    (scene: Scene, delta: number) => {
      if (!isActive || !movementController || !rotationController) {
        return
      }

      const { congaTrailHead, congaWaypointHistory, isCongaTrailStretched, isUserControllable, party } =
        useGlobalStore.getState()

      if (!isUserControllable) {
        if (congaWaypointHistory.length > 0) {
          useGlobalStore.setState({
            congaWaypointHistory: [],
          })
        }
        return
      }

      if (congaWaypointHistory.length === 0) {
        trailDelayRef.current = undefined
        seedCongaHistory(scene, party, delta)
        return
      }

      // The original advances the write head and eases the read heads in the
      // same gated block, so a leader who is standing still — on the ground or
      // hanging on a ladder — leaves the whole line frozen where it is.
      const partySlot = party.findIndex((id) => id === partyMemberId)
      const targetDelay = getCongaTrailDelay(partySlot, isCongaTrailStretched)
      const hasTrailAdvanced = congaTrailHead !== trailHeadRef.current
      if (hasTrailAdvanced) {
        trailHeadRef.current = congaTrailHead
        trailDelayRef.current = easeCongaTrailDelay(
          trailDelayRef.current ?? targetDelay,
          targetDelay,
          delta * TARGET_FPS,
        )
      }

      const trailIndex = Math.min(Math.round(trailDelayRef.current ?? targetDelay), congaWaypointHistory.length - 1)
      const history = congaWaypointHistory.at(-trailIndex - 1)
      if (!history) {
        return
      }

      const { angle, isClimbingLadder, position, speed } = history

      if (!movementController.getState().hasBeenPlaced) {
        movementController.setPosition(position)
        rotationController.turnToFaceAngle(angle, 0)
        return
      }

      if (isClimbingLadder) {
        replayLadderWaypoint(history, hasTrailAdvanced)
        return
      }

      if (movementController.getState().isClimbingLadder) {
        animationController.pauseAnimation(false)
        movementController.refreshWalkmeshTriangle()
        movementController.setIsClimbingLadder(false)
        ladderAnimationRef.current = undefined
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
    [
      animationController,
      isActive,
      movementController,
      partyMemberId,
      replayLadderWaypoint,
      rotationController,
      seedCongaHistory,
    ],
  )

  useFrame((state, delta) => {
    moveToWaypoint(state.scene, delta)
  })
}

export default useFollower
