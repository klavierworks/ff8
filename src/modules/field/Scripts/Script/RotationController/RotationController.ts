import { RefObject } from 'react'
import { Object3D, Scene, Vector3 } from 'three'
import { create } from 'zustand'

import LerpValue from '../../../../../LerpValue'
import { framesToMs } from '../../../../../timing'
import createMovementController from '../MovementController/MovementController'
import {
  getDirectionToVector,
  getShortestRouteToAngle,
  radiansToUnit,
  signedAngleBetweenVectors,
} from './rotationUtils'

// A turn speed can be expressed as:
//   - 'gentle': walking-style turn (~1s per half-revolution, 4 units/frame)
//   - 'fast':   combat-style turn  (~0.5s per half-revolution, 8 units/frame)
//   - a fixed frame count (e.g. 0 = instant snap, 30 = 1 second @ 30Hz)
//   - a per-frame rate object, from which the frame count is derived from the
//     angle delta — so a 180° turn takes twice as long as a 90° turn.
export type TurnSpeed = 'fast' | 'gentle' | number | { ratePerFrame: number }

const GENTLE_RATE_PER_FRAME = { ratePerFrame: 4 }
const FAST_RATE = { ratePerFrame: 8 }

const resolveSpeed = (speed: TurnSpeed): number | { ratePerFrame: number } => {
  if (speed === 'gentle') {
    return GENTLE_RATE_PER_FRAME
  }
  if (speed === 'fast') {
    return FAST_RATE
  }
  return speed
}

const framesForSpeed = (speed: TurnSpeed, angleDelta: number) => {
  const resolved = resolveSpeed(speed)
  if (typeof resolved === 'number') {
    return resolved
  }
  return Math.max(1, Math.ceil(angleDelta / resolved.ratePerFrame))
}

const createRotationController = (
  id: number | string,
  movementController: ReturnType<typeof createMovementController>,
  entityRef: RefObject<null | Object3D>,
) => {
  const { getState, setState } = create(() => ({
    angle: new LerpValue(0),
    id,
    limits: undefined as [number, number] | undefined,
    target: undefined,
  }))

  const setLimits = (min: number, max: number) => {
    setState({ limits: [min, max] })
  }

  const getCurrentDirection = () => {
    const currentAngle = getState().angle.get()
    const radians = (currentAngle * Math.PI) / 128

    const meshUp = new Vector3(0, 0, 1)
    const zeroDirection = new Vector3(0, -1, 0)

    const direction = zeroDirection.clone().applyAxisAngle(meshUp, radians)

    return direction
  }

  const turnToFaceAngle = async (
    angle: number,
    speed: TurnSpeed,
    direction: 'clockwise' | 'counterclockwise' | 'shortest' = 'shortest',
  ) => {
    const currentAngle = getState().angle
    const current = currentAngle.get()

    let targetAngle: number
    if (direction === 'clockwise') {
      targetAngle = current < angle ? angle - 256 : angle
    } else if (direction === 'counterclockwise') {
      targetAngle = current > angle ? angle + 256 : angle
    } else {
      targetAngle = getShortestRouteToAngle(angle, current)
    }

    const limits = getState().limits
    const limitedAngle = limits ? Math.max(limits[0], Math.min(limits[1], targetAngle)) : targetAngle

    const duration = framesForSpeed(speed, Math.abs(limitedAngle - current))

    if (duration === 0) {
      currentAngle.set(limitedAngle % 256)
      return
    }
    await currentAngle.start(limitedAngle % 256, framesToMs(duration))
  }

  const turnToFaceDirection = async (direction: Vector3, speed: TurnSpeed) => {
    const quaternion = entityRef.current?.quaternion.clone()
    if (!quaternion) {
      console.warn('No quaternion found')
      return
    }

    const meshUp = new Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()

    const zeroUnitDirection = new Vector3(0, -1, 0).normalize()
    zeroUnitDirection.z = 0

    const absoluteAngleFromZero = signedAngleBetweenVectors(zeroUnitDirection, direction, meshUp)
    const targetAngle = radiansToUnit(absoluteAngleFromZero)
    await turnToFaceAngle(targetAngle, speed)
  }

  const turnToFaceVector = async (target: Vector3, speed: TurnSpeed) => {
    if (target.equals(movementController.getPosition())) {
      return
    }
    const targetDirection = getDirectionToVector(target, movementController.getPosition())
    await turnToFaceDirection(targetDirection, speed)
  }

  const turnToFaceEntity = async (name: string, scene: Scene, speed: TurnSpeed) => {
    const entity = scene.getObjectByName(name)
    if (!entity) {
      console.warn(`Entity ${name} not found in scene`)
      return
    }
    const target = entity.getWorldPosition(new Vector3())

    await turnToFaceVector(target, speed)
  }

  const stop = () => {
    getState().angle.stop()
  }

  return {
    getCurrentDirection,
    getState,
    setLimits,
    stop,
    turnToFaceAngle,
    turnToFaceDirection,
    turnToFaceEntity,
    turnToFaceVector,
  }
}

export default createRotationController
