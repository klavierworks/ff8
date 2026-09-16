import { Line3, Object3D, Scene, Vector3 } from 'three'
import { create } from 'zustand'

import type WalkmeshMovementController from '../../../WalkMesh/WalkmeshMovement'

import { DEFAULT_PUSH_RADIUS } from '../../../../../constants/entities'
import PromiseSignal from '../../../../../PromiseSignal'
import { framesToSeconds, TARGET_FPS } from '../../../../../timing'
import { floatingPointToNumber, numberToFloatingPoint } from '../../../../../utils'
import { isTouching } from '../common'
import {
  getAngleToVector,
  getDirectionForAngle,
  getShortestRouteToAngle,
  normaliseAngle,
} from '../RotationController/rotationUtils'
import JumpCurve from './JumpCurve'

const NATIVE_SPEED_TO_TS_PER_FRAME = 1 / (256 * 4096)
const FIELD_MOVEMENT_SCALE = 20
const TURN_UNITS_PER_REVOLUTION = 256

// Field load seeds every entity's speed words with the walk speed, so an entity
// that moves before its first MSPEED runs at a walk rather than a crawl.
const DEFAULT_MOVEMENT_SPEED = (203_000 * FIELD_MOVEMENT_SCALE) >> 9

export type LadderSegmentResult = 'completed' | 'reversed'

// The engine's ladder movers (`+572` modes 3 and 4) do not use the speed words
// at all: every phase is a linear interpolation over a fixed frame count, and
// the player's pad drives the counter forwards and backwards during the climb.
type LadderSegment = {
  end: Vector3
  frame: number
  frameCount: number
  lastDirection: number
  options: LadderSegmentOptions
  start: Vector3
}

type LadderSegmentOptions = {
  getDirection?: () => number
  onDirectionChange?: (direction: number) => void
}

type MoveOptions = {
  customMovementTarget: undefined | Vector3
  distanceToStopAnimationFromTarget: number
  duration: number | undefined
  isAllowedToCrossBlockedTriangles: boolean
  isAllowedToLeaveWalkmesh: boolean
  isAnimationEnabled: boolean
  isClimbingLadder: boolean
  isFacingTarget: boolean
  targetSpeed: number | undefined
  userControlledSpeed: number | undefined
}

type SpeedRamp = {
  current: number
  target: number
}

// The engine limits the movement heading against the entity's facing and writes
// the facing back from it, so a move seeds its heading from wherever the entity
// is already looking rather than from the direction of the target.
type Turn = {
  accumulator: number
  heading: number
}

// Scaling the step by the distance still to run makes the speed land exactly on
// the target as the entity arrives, however long the move is.
const calculateRampedSpeed = (ramp: SpeedRamp, remainingDistance: number, elapsedFrames: number) => {
  const nativeDistance = floatingPointToNumber(remainingDistance)
  const difference = FIELD_MOVEMENT_SCALE * (ramp.target - ramp.current)
  const stepPerFrame = nativeDistance > 0 ? Math.trunc(difference / nativeDistance) : difference
  const speed = ramp.current + stepPerFrame * elapsedFrames

  return ramp.target > ramp.current ? Math.min(speed, ramp.target) : Math.max(speed, ramp.target)
}

// MLIMIT caps how far the movement heading may swing toward the target each
// frame. The accumulator sums the clamped turns, so weaving nets out to nothing
// but a one-way spiral does not: a mover that has spent a whole revolution on
// clamped turns is circling a target it cannot turn tightly enough to reach, and
// drops the limit rather than orbiting forever.
const applyTurnRateLimit = (turn: Turn, desiredHeading: number, limitPerFrame: number) => {
  if (limitPerFrame <= 0 || Math.abs(turn.accumulator) > TURN_UNITS_PER_REVOLUTION) {
    return { accumulator: turn.accumulator, heading: desiredHeading }
  }

  const shortestTurn = getShortestRouteToAngle(desiredHeading, turn.heading) - turn.heading
  if (Math.abs(shortestTurn) < limitPerFrame) {
    return { accumulator: turn.accumulator, heading: desiredHeading }
  }

  const step = Math.sign(shortestTurn) * limitPerFrame

  return {
    accumulator: turn.accumulator + step,
    heading: normaliseAngle(turn.heading + step),
  }
}

const createMovementController = (id: number, walkmeshController: WalkmeshMovementController) => {
  const { getState, setState, subscribe } = create(() => ({
    bodyRadius: DEFAULT_PUSH_RADIUS,
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
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
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
      speedRamp: undefined as SpeedRamp | undefined,
      targetObject: undefined as Object3D | undefined,
      turn: undefined as Turn | undefined,
      userControlledSpeed: undefined as number | undefined,
      walkmeshTriangle: null as null | number,
      waypoints: undefined as undefined | Vector3[],
    },
    turnRateLimit: 0,
  }))

  let ladderSegment: LadderSegment | undefined
  let ladderResult: LadderSegmentResult | undefined

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

  const setBodyRadius = (radius: number) => {
    setState({
      bodyRadius: radius,
    })
  }

  // MLIMIT is a byte in the engine, and scripts do pass values above 255 (one
  // passes 360, which the truncation turns into 104). Zero leaves the mover
  // re-aiming straight at its target every frame.
  const setTurnRateLimit = (limit: number) => {
    setState({
      turnRateLimit: limit & 0xff,
    })
  }

  const applySpeedRamp = (remainingDistance: number, delta: number) => {
    const { speedRamp } = getState().position
    if (!speedRamp) {
      return
    }

    setState({
      position: {
        ...getState().position,
        speedRamp: {
          ...speedRamp,
          current: calculateRampedSpeed(speedRamp, remainingDistance, delta * TARGET_FPS),
        },
      },
    })
  }

  // Placement is instant, not a movement. Routing it through waypoints let a
  // MOVE opcode later in the same script tick overwrite the waypoint before the
  // next tick consumed it, leaving the entity parked on the -999 sentinel.
  const setPosition = (position: Vector3, walkmeshTriangle?: number) => {
    let triangle: null | number = walkmeshTriangle ?? null
    if (triangle === null) {
      triangle = walkmeshController.getTriangleForPosition(position, undefined, true)
    }

    resolvePendingPositionSignal()

    setState({
      hasBeenPlaced: true,
      position: {
        ...getState().position,
        current: getState().position.current.copy(position),
        duration: 0,
        isAnimationEnabled: false,
        isFacingTarget: false,
        isPaused: true,
        signal: undefined,
        speedRamp: undefined,
        turn: undefined,
        walkmeshTriangle: triangle,
        waypoints: undefined,
      },
    })
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
      targetSpeed: undefined,
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
      targetSpeed,
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
        speedRamp: targetSpeed === undefined ? undefined : { current: getState().movementSpeed, target: targetSpeed },
        targetObject,
        turn: undefined,
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

  const getLandingPosition = (end: Vector3, walkmeshTriangle?: number) => {
    if (walkmeshTriangle === undefined) {
      return end
    }
    const height = walkmeshController.getPlaneHeightOnTriangle(end.x, end.y, walkmeshTriangle)
    if (height === null) {
      return end
    }
    return new Vector3(end.x, end.y, height)
  }

  const jumpToPosition = (end: Vector3, duration: number, walkmeshTriangle?: number) => {
    const start = getState().position.current.clone()
    const landing = getLandingPosition(end, walkmeshTriangle)

    const directLine = new Line3(start, landing)
    const jumpCurve = new JumpCurve(start, landing, duration)

    resolvePendingJumpSignal()
    const signal = new PromiseSignal()
    setState((state) => ({
      jump: {
        curve: jumpCurve,
        directLine,
        duration,
        progress: 0,
        signal,
      },
      position: {
        ...state.position,
        walkmeshTriangle: walkmeshTriangle ?? state.position.walkmeshTriangle,
      },
    }))
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
        speedRamp: undefined,
        turn: undefined,
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

  const setIsClimbingLadder = (isClimbingLadder: boolean) =>
    setState({
      isClimbingLadder,
      position: {
        ...getState().position,
        isClimbingLadder,
      },
    })

  // Followers replay the leader's recorded ladder positions verbatim, the way
  // the engine writes the trail entry straight into the follower's coordinates.
  const setLadderPosition = (position: Vector3) => {
    resolvePendingPositionSignal()

    setState({
      hasBeenPlaced: true,
      position: {
        ...getState().position,
        current: getState().position.current.copy(position),
        isPaused: true,
        speedRamp: undefined,
        turn: undefined,
        waypoints: undefined,
      },
    })
  }

  // A ladder leaves the walkmesh entirely, so the triangle it started on is
  // meaningless by the time it ends and Model.tsx would snap the mesh to that
  // triangle's plane extrapolated far outside itself.
  const refreshWalkmeshTriangle = () => {
    setState({
      position: {
        ...getState().position,
        walkmeshTriangle: walkmeshController.getTriangleForPosition(getState().position.current, undefined, true),
      },
    })
  }

  const finishLadderSegment = (result: LadderSegmentResult) => {
    if (!ladderSegment) {
      return
    }
    ladderSegment = undefined
    ladderResult = result
  }

  const getLadderResult = () => ladderResult

  // The approach, dismount and settle phases feed the party trail on every
  // frame, but the climb feeds it only on frames the counter actually moved:
  // stopping halfway up a ladder has to stop the line behind you dead, or it
  // keeps eating the gap while the leader hangs there.
  const getHasLadderAdvanced = () => ladderSegment !== undefined && ladderSegment.lastDirection !== 0

  const applyLadderFrame = (segment: LadderSegment) => {
    const progress = segment.frameCount > 0 ? Math.min(1, segment.frame / segment.frameCount) : 1
    getState().position.current.lerpVectors(segment.start, segment.end, progress)
  }

  const moveAlongLadder = (start: Vector3, end: Vector3, frameCount: number, options: LadderSegmentOptions = {}) => {
    finishLadderSegment('completed')
    resolvePendingPositionSignal()

    setState({
      position: {
        ...getState().position,
        isPaused: false,
        speedRamp: undefined,
        turn: undefined,
        waypoints: undefined,
      },
    })

    ladderResult = undefined
    ladderSegment = {
      end: end.clone(),
      frame: 0,
      frameCount: Math.max(0, frameCount),
      lastDirection: 0,
      options,
      start: start.clone(),
    }
  }

  const tickLadder = (delta: number) => {
    const segment = ladderSegment
    if (!segment) {
      return false
    }
    if (getState().position.isPaused) {
      return true
    }

    const direction = segment.options.getDirection ? segment.options.getDirection() : 1
    if (direction !== segment.lastDirection) {
      segment.lastDirection = direction
      segment.options.onDirectionChange?.(direction)
    }

    segment.frame += direction * delta * TARGET_FPS

    if (direction < 0 && segment.frame <= 0) {
      segment.frame = 0
      applyLadderFrame(segment)
      finishLadderSegment('reversed')
      return true
    }

    if (segment.frame >= segment.frameCount) {
      segment.frame = segment.frameCount
      applyLadderFrame(segment)
      finishLadderSegment('completed')
      return true
    }

    applyLadderFrame(segment)
    return true
  }

  // A move that leaves the walkmesh still has to keep the triangle current:
  // Model.tsx snaps the mesh to that triangle's plane, so a triangle left over
  // from the previous waypoint gets extrapolated far outside itself (the
  // ectake2 car floating below the road on the ramp and the exit turn). Null is
  // a valid result here — off the mesh there is no floor to snap to.
  const updateWalkmeshTriangleForFreeMove = (position: Vector3) => {
    const triangle = walkmeshController.getTriangleForPosition(position, undefined, true)
    if (triangle === getState().position.walkmeshTriangle) {
      return
    }

    setState({
      position: {
        ...getState().position,
        walkmeshTriangle: triangle,
      },
    })
  }

  const updateTurn = (target: Vector3, facingAngle: number, delta: number) => {
    const { position, turnRateLimit } = getState()
    const turn = position.turn ?? { accumulator: 0, heading: normaliseAngle(facingAngle) }

    const nextTurn = applyTurnRateLimit(
      turn,
      getAngleToVector(target, position.current),
      turnRateLimit * delta * TARGET_FPS,
    )

    setState({
      position: {
        ...position,
        turn: nextTurn,
      },
    })

    return nextTurn
  }

  const applyPositionToEntity = (entity: Object3D) => {
    if (getState().position.current.x !== -999) {
      setState({
        hasBeenPlaced: true,
      })
    }

    const { x, y, z } = getPosition()
    entity.position.set(x, y, z)
  }

  const tick = (entity: Object3D, delta: number, scene: Scene, facingAngle: number) => {
    if (tickLadder(delta)) {
      applyPositionToEntity(entity)
      return
    }

    const { jump, offset, position } = getState()

    if (position.isPaused && offset.isPaused) {
      applyPositionToEntity(entity)
      return
    }
    if (!position.waypoints && !offset.goal && !jump.directLine) {
      applyPositionToEntity(entity)
      return
    }

    const { current: currentPosition, duration, targetObject, waypoints } = position

    const positionGoal = waypoints?.[0]
    if (positionGoal) {
      // Walkmesh moves arrive on planar (XY) distance — Z is owned by the floor,
      // so a script target Z that differs from the walkmesh would otherwise make
      // the 3D distance never drop below a step and the move never complete
      // (matching the original, which tests dx²+dy² only). Free moves stay 3D.
      const remainingDistance = position.isAllowedToLeaveWalkmesh
        ? currentPosition.distanceTo(positionGoal)
        : Math.hypot(positionGoal.x - currentPosition.x, positionGoal.y - currentPosition.y)

      applySpeedRamp(remainingDistance, delta)

      const speedPerSecond = getMovementSpeed() * NATIVE_SPEED_TO_TS_PER_FRAME * TARGET_FPS
      const maxDistance = speedPerSecond * delta

      const isTouchingTarget = targetObject ? isTouching(id, targetObject, scene) : false
      if (isTouchingTarget) {
        resolvePendingPositionSignal()
        setState({
          position: {
            ...getState().position,
            isPaused: true,
            speedRamp: undefined,
            turn: undefined,
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
            speedRamp: undefined,
            turn: undefined,
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
        updateWalkmeshTriangleForFreeMove(currentPosition)
      } else {
        const { heading } = updateTurn(positionGoal, facingAngle, delta)
        const direction = getDirectionForAngle(heading)
        const step = walkmeshController.getNextPositionOnWalkmesh(currentPosition, direction, maxDistance, {
          bodyRadius: numberToFloatingPoint(getState().bodyRadius),
          isAllowedToCrossBlockedTriangles: position.isAllowedToCrossBlockedTriangles,
          triangleId: getState().position.walkmeshTriangle ?? undefined,
        })
        currentPosition.copy(step.position)
        if (step.triangleId !== null && step.triangleId !== getState().position.walkmeshTriangle) {
          setState({
            position: {
              ...getState().position,
              walkmeshTriangle: step.triangleId,
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
    applyPositionToEntity(entity)
  }

  const reset = () => {
    resolvePendingOffsetSignal()
    resolvePendingPositionSignal()
    finishLadderSegment('completed')

    setState((state) => ({
      bodyRadius: DEFAULT_PUSH_RADIUS,
      hasBeenPlaced: false,
      hasMoved: false,
      isClimbingLadder: false,
      movementSpeed: DEFAULT_MOVEMENT_SPEED,
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
        speedRamp: undefined,
        turn: undefined,
        userControlledSpeed: undefined,
        walkmeshTriangle: null,
      },
      turnRateLimit: 0,
    }))
  }

  const setHasMoved = (hasMoved: boolean) => {
    setState({
      hasMoved,
    })
  }

  // The lead character never gets waypoints: useControls steps it with
  // setPosition every frame, so its movement shows up only as a user speed.
  const isMoving = () => {
    const { isPaused, userControlledSpeed, waypoints } = getState().position
    if (userControlledSpeed !== undefined) {
      return true
    }
    return waypoints !== undefined && isPaused === false
  }

  const getMovementSpeed = () => {
    const {
      movementSpeed,
      position: { speedRamp, userControlledSpeed },
    } = getState()
    if (userControlledSpeed !== undefined) {
      return userControlledSpeed
    }
    return speedRamp ? speedRamp.current : movementSpeed
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
    getHasLadderAdvanced,
    getLadderResult,
    getMovementPosition,
    getMovementSpeed,
    getPosition,
    getState,
    isMoving,
    jumpToPosition,
    moveAlongLadder,
    moveToObject,
    moveToOffset,
    moveToPoint,
    pause,
    refreshWalkmeshTriangle,
    reset,
    resume,
    setBodyRadius,
    setHasMoved,
    setIsClimbingLadder,
    setLadderPosition,
    setMovementSpeed,
    setOffset,
    setPosition,
    setTurnRateLimit,
    setUserControlledSpeed,
    stop,
    subscribe,
    tick,
  }
}

export default createMovementController
