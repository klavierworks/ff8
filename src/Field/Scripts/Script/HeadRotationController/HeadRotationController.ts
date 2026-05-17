import { Bone, Euler, Quaternion, Scene, Vector3 } from "three";
import { create } from "zustand";
import createMovementController from "../MovementController/MovementController";
import createRotationController from "../RotationController/RotationController";
import { getShortestRouteToAngle, radiansToUnit, signedAngleBetweenVectors } from "../RotationController/rotationUtils";
import LerpValue, { cosineEaseInOut } from "../../../../LerpValue";
import { framesToMs } from "../../../../timing";

export type TurnSpeed = number

const HEAD_EULER_ORDER = 'XYZ'

type Limits = {
  pitchMax: number
  pitchMin: number
  yawMax: number
  yawMin: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const createHeadRotationController = (
  id: number | string,
  movementController: ReturnType<typeof createMovementController>,
  rotationController: ReturnType<typeof createRotationController>,
) => {
  const { getState, setState } = create(() => ({
    bindQuaternion: undefined as Quaternion | undefined,
    bone: undefined as Bone | undefined,
    id,
    interactionId: 0,
    isActive: false,
    limits: undefined as Limits | undefined,
    pitch: new LerpValue(0, 1.0, cosineEaseInOut),
    yaw: new LerpValue(0, 1.0, cosineEaseInOut),
  }))

  const scratchEuler = new Euler(0, 0, 0, HEAD_EULER_ORDER)
  const scratchQuaternion = new Quaternion()

  const setBone = (bone: Bone | undefined) => {
    setState((state) => {
      if (!bone) {
        return { bindQuaternion: undefined, bone: undefined }
      }
      if (state.bone === bone && state.bindQuaternion) {
        return state
      }
      return { bindQuaternion: bone.quaternion.clone(), bone }
    })
  }

  const setLimits = (pitchLimit: number, yawLimit: number) => {
    setState({
      limits: {
        pitchMax: pitchLimit,
        pitchMin: -pitchLimit,
        yawMax: yawLimit,
        yawMin: -yawLimit,
      },
    })
  }

  const turnToFaceAngles = async (yawTarget: number, pitchTarget: number, speed: TurnSpeed) => {
    setState((state) => ({ interactionId: state.interactionId + 1, isActive: true }))
    const { yaw, pitch, limits } = getState()

    const yawShortest = getShortestRouteToAngle(yawTarget, yaw.get())
    const pitchShortest = getShortestRouteToAngle(pitchTarget, pitch.get())
    const yawClamped = limits ? clamp(yawShortest, limits.yawMin, limits.yawMax) : yawShortest
    const pitchClamped = limits ? clamp(pitchShortest, limits.pitchMin, limits.pitchMax) : pitchShortest

    if (speed === 0) {
      yaw.set(yawClamped)
      pitch.set(pitchClamped)
      return
    }

    const ms = framesToMs(speed)
    await Promise.all([yaw.start(yawClamped, ms), pitch.start(pitchClamped, ms)])
  }

  const turnToFaceWorldPosition = async (target: Vector3, speed: TurnSpeed) => {
    const current = movementController.getPosition()
    if (target.equals(current)) {
      return
    }

    const dx = target.x - current.x
    const dy = target.y - current.y
    const dz = target.z - current.z
    const horizontalDistance = Math.sqrt(dx * dx + dy * dy)

    const meshUp = new Vector3(0, 0, 1)
    const zeroReference = new Vector3(0, -1, 0)
    const horizontalDelta = new Vector3(dx, dy, 0)
    const worldYawRadians = signedAngleBetweenVectors(zeroReference, horizontalDelta, meshUp)
    const bodyAngle = rotationController.getState().angle.get()
    const bodyRelativeYaw = radiansToUnit(worldYawRadians) - bodyAngle

    const pitchRadians = Math.atan2(dz, horizontalDistance)
    const pitch = radiansToUnit(pitchRadians)

    await turnToFaceAngles(bodyRelativeYaw, pitch, speed)
  }

  const turnToFaceEntity = async (name: string, scene: Scene, speed: TurnSpeed) => {
    const entity = scene.getObjectByName(name)
    if (!entity) {
      console.warn(`Entity ${name} not found in scene`)
      return
    }
    const target = entity.getWorldPosition(new Vector3())

    await turnToFaceWorldPosition(target, speed)
  }

  // LerpValue.start() resolves its prior promise via .stop(), so the .then fires
  // even when a new turn interrupts us. Compare interactionId to distinguish
  // natural completion from interruption.
  const disable = (yawTarget: number, pitchTarget: number, speed: TurnSpeed) => {
    const promise = turnToFaceAngles(yawTarget, pitchTarget, speed)
    const myInteractionId = getState().interactionId
    promise.then(() => {
      if (getState().interactionId === myInteractionId) {
        setState({ isActive: false })
      }
    })
    return promise
  }

  const sync = async () => {
    while (getState().yaw.isAnimating || getState().pitch.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  }

  const tick = () => {
    const { bindQuaternion, bone, isActive, pitch, yaw } = getState()
    if (!bone || !bindQuaternion || !isActive) {
      return
    }
    scratchEuler.set((pitch.get() * Math.PI) / 128, (yaw.get() * Math.PI) / 128, 0, HEAD_EULER_ORDER)
    scratchQuaternion.setFromEuler(scratchEuler)
    bone.quaternion.copy(bindQuaternion).multiply(scratchQuaternion)
  }

  return {
    disable,
    getState,
    setBone,
    setLimits,
    sync,
    tick,
    turnToFaceAngles,
    turnToFaceEntity,
    turnToFaceWorldPosition,
  }
}

export default createHeadRotationController
