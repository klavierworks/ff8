import { Group, Object3D, Scene, Vector3 } from "three";
import { create } from "zustand";
import createMovementController from "../MovementController/MovementController";
import { getDirectionToVector, getShortestRouteToAngle, radiansToUnit, signedAngleBetweenVectors } from "./rotationUtils";
import { RefObject } from "react";
import LerpValue from "../../../../LerpValue";

const createRotationController = (
  id: string | number,
  movementController: ReturnType<typeof createMovementController>,
  entityRef: RefObject<Object3D | null>
) => {
  const { getState, setState } = create(() => ({
    angle: new LerpValue(0),
    id,
    limits: undefined as [number, number] | undefined,
    target: undefined,
  }));

  const setLimits = (min: number, max: number) => {
    setState({ limits: [min, max] });
  }

  const getCurrentDirection = () => {
    const currentAngle = getState().angle.get();
    const radians = (currentAngle * Math.PI) / 128;
    
    const meshUp = new Vector3(0, 0, 1);
    const zeroDirection = new Vector3(0, -1, 0); // Starting direction
    
    // Apply rotation around Z-axis
    const direction = zeroDirection.clone().applyAxisAngle(meshUp, radians);
    
    return direction;
  }

  const turnToFaceAngle = async (angle: number, duration: number, _direction: 'left' | 'right' | 'either' = 'either') => {
    const currentAngle = getState().angle
    const targetAngle = getShortestRouteToAngle(angle, currentAngle.get());

    const limits = getState().limits;
    const limitedAngle = limits ? Math.max(limits[0], Math.min(limits[1], targetAngle)) : targetAngle;

    if (duration === 0) {
      currentAngle.set(limitedAngle % 256);
      return;
    }
    await currentAngle.start(limitedAngle % 256, duration * 1000 / 30);
  }

  const turnToFaceDirection = async (direction: Vector3, duration: number) => {
    const quaternion = entityRef.current?.quaternion.clone()
    if (!quaternion) {
      console.warn("No quaternion found");
      return;
    }

    const meshUp = new Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

    const zeroUnitDirection = new Vector3(0, -1, 0).normalize();
    zeroUnitDirection.z = 0;

    const absoluteAngleFromZero = signedAngleBetweenVectors(zeroUnitDirection, direction, meshUp);
    const targetAngle = radiansToUnit(absoluteAngleFromZero);
    await turnToFaceAngle(targetAngle, duration);
  }

  const turnToFaceVector = async (target: Vector3, duration: number) => {
    if (target.equals(movementController.getPosition())) {
      return;
    }
    const targetDirection = getDirectionToVector(target, movementController.getPosition());
    await turnToFaceDirection(targetDirection, duration);
  }
  
  const turnToFaceEntity = async (name: string, scene: Scene, duration: number) => {
    const entity = scene.getObjectByName(name);
    if (!entity) {
      console.warn(`Entity ${name} not found in scene`);
      return;
    }
    const target = entity.getWorldPosition(new Vector3());

    await turnToFaceVector(target, duration);
  }

  const stop = () => {
    getState().angle.stop();
  }

  return {
    getState,
    getCurrentDirection,
    turnToFaceAngle,
    turnToFaceEntity,
    turnToFaceVector,
    turnToFaceDirection,
    setLimits,
    stop,
  }
}

export default createRotationController;