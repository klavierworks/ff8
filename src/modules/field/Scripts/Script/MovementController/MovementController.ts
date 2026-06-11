import { Line3, Object3D, Scene, Vector3 } from 'three'
import { create } from 'zustand'

import type WalkmeshMovementController from '../../../WalkMesh/WalkmeshMovement'

import PromiseSignal from '../../../../../PromiseSignal'
import { framesToSeconds, TARGET_FPS } from '../../../../../timing'
import { numberToFloatingPoint } from '../../../../../utils'
import { isTouching } from '../common'
import JumpCurve from './JumpCurve'

const NATIVE_SPEED_TO_TS_PER_FRAME = 1 / (256 * 4096)

type MoveOptions = {
  customMovementTarget: undefined | Vector3
  distanceToStopAnimationFromTarget: number
  duration: number | undefined
  isAllowedToCrossBlockedTriangles: boolean
  isAllowedToLeaveWalkmesh: boolean
  isAnimationEnabled: boolean
  isClimbingLadder: boolean
  isFacingTarget: boolean
  userControlledSpeed: number | undefined
}

const createMovementController = (id: number, walkmeshController: WalkmeshMovementController) => {
  const { getState, setState, subscribe } = create(() => ({
    footsteps: {
      isActive: false,
      leftSound: undefined as Howl | undefined,
      rightSound: undefined as Howl | undefined,
    },
    hasBeenPlaced: false,
    hasMoved: false,
    id,
    isClimbingLadder: false,
    jump: {
      curve: null as JumpCurve | null,
      directLine: null as Line3 | null,
      duration: 0,
      progress: 0,
      signal: undefined as PromiseSignal | undefined,
    },
    movementSpeed: 2560,
    offset: {
      current: new Vector3(0, 0, 0),
      duration: 0,
      goal: undefined as undefined | Vector3,
      isPaused: false,
      signal: undefined as PromiseSignal | undefined,
      totalDistance: 0,
    },
    position: {
      current: new Vector3(-999, 0, 0),
      distanceToStopAnimationFromTarget: 0,
      duration: 0 as number | undefined,
      isAllowedToCrossBlockedTriangles: true,
      isAllowedToLeaveWalkmesh: false,
      isAnimationEnabled: true,
      isClimbingLadder: false,
      isFacingTarget: true,
      isPaused: false,
      signal: undefined as PromiseSignal | undefined,
      targetObject: undefined as Object3D | undefined,
      userControlledSpeed: undefined as number | undefined,
      walkmeshTriangle: null as null | number,
      waypoints: undefined as undefined | Vector3[],
    },
    speedBeforeClimbingLadder: 0,
  }))

  const resolvePendingPositionSignal = () => {
    const { position } = getState()
    if (position.signal) {
      position.signal.resolve()
      setState({
        position: {
          ...position,
          signal: undefined,
        },
      })
    }
  }

  const resolvePendingOffsetSignal = () => {
    const { offset } = getState()
    if (offset.signal) {
      offset.signal.resolve()
      setState({
        offset: {
          ...offset,
          signal: undefined,
        },
      })
    }
  }

  const resolvePendingJumpSignal = () => {
    const { jump } = getState()
    if (jump.signal) {
      jump.signal.resolve()
      setState({
        jump: {
          ...jump,
          signal: undefined,
        },
      })
    }
  }

  const setMovementSpeed = (speed: number) => {
    setState({
      movementSpeed: speed,
    })
  }

  const setPosition = async (position: Vector3, walkmeshTriangle?: number) => {
    let triangle: null | number = walkmeshTriangle ?? null
    if (triangle === null) {
      triangle = walkmeshController.getTriangleForPosition(position, undefined, true)
    }

    resolvePendingPositionSignal()
    const signal = new PromiseSignal()

    setState({
      position: {
        ...getState().position,
        duration: 0,
        isAnimationEnabled: false,
        isFacingTarget: false,
        isPaused: false,
        signal,
        walkmeshTriangle: triangle,
        waypoints: [position],
      },
    })

    await signal.promise
  }

  const setOffset = (x: number, y: number, z: number) => {
    const target = new Vector3(...[x, y, z].map(numberToFloatingPoint))

    resolvePendingOffsetSignal()
    setState({
      offset: {
        ...getState().offset,
        duration: 0,
        goal: target,
        isPaused: false,
        signal: undefined,
      },
    })
  }

  const moveToPoint = async (target: Vector3, passedOptions?: Partial<MoveOptions>, targetObject?: Object3D) => {
    const defaultOptions: MoveOptions = {
      customMovementTarget: undefined,
      distanceToStopAnimationFromTarget: 0,
      duration: undefined,
      isAllowedToCrossBlockedTriangles: true,
      isAllowedToLeaveWalkmesh: false,
      isAnimationEnabled: true,
      isClimbingLadder: false,
      isFacingTarget: true,
      userControlledSpeed: undefined,
    }

    const {
      distanceToStopAnimationFromTarget,
      duration,
      isAllowedToCrossBlockedTriangles,
      isAllowedToLeaveWalkmesh,
      isAnimationEnabled,
      isClimbingLadder,
      isFacingTarget,
      userControlledSpeed,
    } = {
      ...defaultOptions,
      ...passedOptions,
    }

    resolvePendingPositionSignal()
    const signal = new PromiseSignal()

    setState({
      position: {
        current: getState().position.current,
        distanceToStopAnimationFromTarget,
        duration: duration && duration > 0 ? duration : undefined,
        isAllowedToCrossBlockedTriangles,
        isAllowedToLeaveWalkmesh,
        isAnimationEnabled,
        isClimbingLadder,
        isFacingTarget,
        isPaused: false,
        signal,
        targetObject,
        userControlledSpeed,
        walkmeshTriangle: getState().position.walkmeshTriangle,
        waypoints: [target],
      },
    })

    await signal.promise
  }

  const moveToObject = async (name: string, scene: Scene, passedOptions?: Partial<MoveOptions>) => {
    const targetActor = scene.getObjectByName(name)

    if (!targetActor) {
      console.warn('Target object not found', name)
      return
    }

    const target = targetActor.getWorldPosition(new Vector3())

    await moveToPoint(target, passedOptions, targetActor)
  }

  const jumpToPosition = (end: Vector3, duration: number) => {
    const start = getState().position.current.clone()

    const directLine = new Line3(start, end)
    const jumpCurve = new JumpCurve(start, end, duration)

    resolvePendingJumpSignal()
    const signal = new PromiseSignal()
    setState({
      jump: {
        curve: jumpCurve,
        directLine,
        duration,
        progress: 0,
        signal,
      },
    })
  }

  const moveToOffset = async (x: number, y: number, z: number, duration: number) => {
    const target = new Vector3(...[x, y, z].map(numberToFloatingPoint))
    const currentOffset = getState().offset.current
    const totalDistance = currentOffset.distanceTo(target)

    resolvePendingOffsetSignal()
    const signal = new PromiseSignal()
    setState({
      offset: {
        current: getState().offset.current,
        duration,
        goal: target,
        isPaused: false,
        signal,
        totalDistance,
      },
    })

    await signal.promise
  }

  const getPosition = () => {
    const { offset, position } = getState()
    const positionValue = position.current
    const offsetValue = offset.current

    return {
      x: positionValue.x + offsetValue.x,
      y: positionValue.y + offsetValue.y,
      z: positionValue.z + offsetValue.z,
    }
  }

  const getMovementPosition = () => {
    const { current } = getState().position
    return { x: current.x, y: current.y, z: current.z }
  }

  const stop = () => {
    setState({
      offset: {
        ...getState().offset,
        goal: undefined,
      },
      position: {
        ...getState().position,
        waypoints: undefined,
      },
    })
  }

  let positionPauseStateBeforePause = false
  let offsetPauseStateBeforePause = false
  const pause = () => {
    positionPauseStateBeforePause = getState().position.isPaused
    offsetPauseStateBeforePause = getState().offset.isPaused

    setState({
      offset: {
        ...getState().offset,
        isPaused: true,
      },
      position: {
        ...getState().position,
        isPaused: true,
      },
    })
  }

  const resume = () => {
    setState({
      offset: {
        ...getState().offset,
        isPaused: offsetPauseStateBeforePause,
      },
      position: {
        ...getState().position,
        isPaused: positionPauseStateBeforePause,
      },
    })
  }

  const setFootsteps = () =>
    setState((state) => ({
      footsteps: {
        ...state.footsteps,
        leftSound: new Howl({
          loop: false,
          mute: false,
          preload: true,
          src: `/audio/footsteps/2.mp3`,
          volume: 1,
        }),
        rightSound: new Howl({
          loop: false,
          mute: false,
          preload: true,
          src: `/audio/footsteps/3.mp3`,
          volume: 1,
        }),
      },
    }))

  const enableFootsteps = () =>
    setState((state) => ({
      footsteps: {
        ...state.footsteps,
        isActive: true,
      },
    }))

  const disableFootsteps = () =>
    setState((state) => ({
      footsteps: {
        ...state.footsteps,
        isActive: false,
      },
    }))

  const resetFootsteps = () =>
    setState({
      footsteps: {
        isActive: false,
        leftSound: undefined,
        rightSound: undefined,
      },
    })

  const setIsClimbingLadder = (isClimbingLadder: boolean, speed?: number) =>
    setState({
      isClimbingLadder,
      movementSpeed: isClimbingLadder ? (speed ?? 22) * 100 : getState().speedBeforeClimbingLadder,
      speedBeforeClimbingLadder: isClimbingLadder ? getState().movementSpeed : 0,
    })

  const tick = (entity: Object3D, delta: number, scene: Scene) => {
    const { jump, offset, position } = getState()

    if (position.isPaused && offset.isPaused) {
      return
    }
    if (!position.waypoints && !offset.goal && !jump.directLine) {
      return
    }

    const { current: currentPosition, duration, targetObject, waypoints } = position

    const movementSpeed = getMovementSpeed()

    const positionGoal = waypoints?.[0]
    if (positionGoal) {
      const speedPerSecond = movementSpeed * NATIVE_SPEED_TO_TS_PER_FRAME * TARGET_FPS
      const maxDistance = speedPerSecond * delta

      // Walkmesh moves arrive on planar (XY) distance — Z is owned by the floor,
      // so a script target Z that differs from the walkmesh would otherwise make
      // the 3D distance never drop below a step and the move never complete
      // (ports sub_479970, which tests dx²+dy² only). Free moves stay 3D.
      const remainingDistance = position.isAllowedToLeaveWalkmesh
        ? currentPosition.distanceTo(positionGoal)
        : Math.hypot(positionGoal.x - currentPosition.x, positionGoal.y - currentPosition.y)

      const isTouchingTarget = targetObject ? isTouching(id, targetObject, scene) : false
      if (isTouchingTarget) {
        resolvePendingPositionSignal()
        setState({
          position: {
            ...getState().position,
            isPaused: true,
            userControlledSpeed: undefined,
            walkmeshTriangle:
              walkmeshController.getTriangleForPosition(positionGoal, undefined, true) ??
              getState().position.walkmeshTriangle,
            waypoints: undefined,
          },
        })
        return
      }

      if (remainingDistance <= maxDistance || duration === 0) {
        if (position.isAllowedToLeaveWalkmesh || duration === 0) {
          currentPosition.copy(positionGoal)
        } else {
          currentPosition.x = positionGoal.x
          currentPosition.y = positionGoal.y
        }
        setState({
          position: {
            ...getState().position,
            isPaused: true,
            userControlledSpeed: undefined,
            walkmeshTriangle:
              walkmeshController.getTriangleForPosition(positionGoal, undefined, true) ??
              getState().position.walkmeshTriangle,
            waypoints: undefined,
          },
        })
      } else if (position.isAllowedToLeaveWalkmesh) {
        const direction = positionGoal.clone().sub(currentPosition).normalize()
        currentPosition.add(direction.multiplyScalar(maxDistance))
      } else {
        const direction = new Vector3().subVectors(positionGoal, currentPosition)
        direction.z = 0
        direction.normalize()
        const newPosition = walkmeshController.getNextPositionOnWalkmesh(
          currentPosition,
          direction,
          maxDistance,
          getState().position.walkmeshTriangle ?? undefined,
          position.isAllowedToCrossBlockedTriangles,
        )
        currentPosition.copy(newPosition)
        const triangle = walkmeshController.getTriangleForPosition(currentPosition, undefined, true)
        if (triangle !== null && triangle !== undefined && triangle !== getState().position.walkmeshTriangle) {
          setState({
            position: {
              ...getState().position,
              walkmeshTriangle: triangle,
            },
          })
        }
      }

      if (!getState().position.waypoints) {
        resolvePendingPositionSignal()
      }
    }

    const { current: currentOffset, duration: offsetDuration, goal: offsetGoal, totalDistance } = offset

    if (offsetGoal) {
      const durationInSeconds = framesToSeconds(offsetDuration)
      const remainingDistance = currentOffset.distanceTo(offsetGoal)

      if (remainingDistance < 0.0005 || durationInSeconds <= 0) {
        currentOffset.copy(offsetGoal)
        resolvePendingOffsetSignal()
        setState({
          offset: {
            ...getState().offset,
            goal: undefined,
            isPaused: true,
          },
        })
      } else {
        const speed = totalDistance / durationInSeconds
        const maxDistance = speed * delta
        const stepDistance = Math.min(maxDistance, remainingDistance)

        const direction = offsetGoal.clone().sub(currentOffset).normalize()
        currentOffset.add(direction.multiplyScalar(stepDistance))
      }
    }

    const { curve, directLine, duration: jumpDuration, progress } = jump
    if (directLine && curve) {
      const durationInSeconds = framesToSeconds(jumpDuration)
      const remainingProgress = Math.abs(1 - progress)

      if (remainingProgress < 0.001 || durationInSeconds <= 0) {
        resolvePendingJumpSignal()
        setState({
          jump: {
            ...getState().jump,
            curve: null,
            directLine: null,
          },
        })

        return
      }

      const progressSpeed = 1 / durationInSeconds
      const maxProgressStep = progressSpeed * delta
      const stepProgress = Math.min(maxProgressStep, remainingProgress)

      const newProgress = Math.max(0, Math.min(1, progress + stepProgress))

      const positionOnLine = directLine.start.clone().lerp(directLine.end, newProgress)
      const positionOnCurve = curve.getPointAt(newProgress)

      currentPosition.copy(positionOnLine)
      currentPosition.z += positionOnCurve.z - positionOnLine.z

      setState({
        jump: {
          ...getState().jump,
          progress: newProgress,
        },
      })
    }
    if (getState().position.current.x !== -999) {
      setState({
        hasBeenPlaced: true,
      })
    }

    entity.position.set(getPosition().x, getPosition().y, getPosition().z)
  }

  const reset = () => {
    resolvePendingOffsetSignal()
    resolvePendingPositionSignal()

    setState((state) => ({
      hasBeenPlaced: false,
      hasMoved: false,
      isClimbingLadder: false,
      movementSpeed: 2560,
      offset: {
        ...state.offset,
        duration: 0,
        goal: undefined,
        isPaused: false,
        signal: undefined,
      },
      position: {
        ...state.position,
        duration: 0,
        goal: undefined,
        isAnimationEnabled: true,
        isFacingTarget: true,
        isPaused: false,
        signal: undefined,
        userControlledSpeed: undefined,
        walkmeshTriangle: null,
      },
      speedBeforeClimbingLadder: 0,
    }))
  }

  const setHasMoved = (hasMoved: boolean) => {
    setState({
      hasMoved,
    })
  }

  const isMoving = () => {
    return getState().position.waypoints !== undefined && getState().position.isPaused === false
  }

  const getMovementSpeed = () => {
    const {
      movementSpeed,
      position: { userControlledSpeed },
    } = getState()
    return userControlledSpeed !== undefined ? userControlledSpeed : movementSpeed
  }

  const setUserControlledSpeed = (speed: number | undefined) => {
    setState({
      position: {
        ...getState().position,
        userControlledSpeed: speed,
      },
    })
  }

  return {
    disableFootsteps,
    enableFootsteps,
    getMovementPosition,
    getMovementSpeed,
    getPosition,
    getState,
    isMoving,
    jumpToPosition,
    moveToObject,
    moveToOffset,
    moveToPoint,
    pause,
    reset,
    resetFootsteps,
    resume,
    setFootsteps,
    setHasMoved,
    setIsClimbingLadder,
    setMovementSpeed,
    setOffset,
    setPosition,
    setUserControlledSpeed,
    stop,
    subscribe,
    tick,
  }
}

export default createMovementController
