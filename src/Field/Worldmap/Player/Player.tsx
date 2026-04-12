import { useCallback, useMemo, useRef, useState } from "react";
import { createAnimationController } from "../../Scripts/Script/AnimationController/AnimationController";
import SquallModel from '../../Scripts/Script/Model/gltf/d001';
import { useFrame } from "@react-three/fiber";
import { Bone, Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from "three";
import useWorldMapControls from "../useWorldMapControls";
import createMovementController from "../../Scripts/Script/MovementController/MovementController";
import createRotationController from "../../Scripts/Script/RotationController/RotationController";
import WorldmapMeshController from "../WorldmapMovementController";

type PlayerProps = {
  worldmapMeshController: WorldmapMeshController
}

const Player = ({ worldmapMeshController }: PlayerProps) => {
  const entityRef = useRef<Object3D>(null);
  const animationController = useMemo(() => createAnimationController(0), []);
  const movementController = useMemo(() => createMovementController(0, worldmapMeshController), [worldmapMeshController]);
  const rotationController = useMemo(() => createRotationController(0, movementController, entityRef), [movementController]);

  const convertMaterialsToBasic = useCallback((group: Group) => {
    group.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        const meshBasicMaterial = new MeshBasicMaterial();
        meshBasicMaterial.color = child.material.color;
        meshBasicMaterial.userData.originalColor = child.material.color.clone();
        meshBasicMaterial.map = child.material.map;
        meshBasicMaterial.side = DoubleSide
        child.material = meshBasicMaterial;
      }
    });
  }, []);

  const setModelRef = useCallback((ref: GltfHandle) => {
    if (!ref || !ref.group) {
      return;
    }

    convertMaterialsToBasic(ref.group.current);
    animationController.setHeadBone(ref.nodes.bone_4 as unknown as Bone);
    animationController.initialize(ref.animations.mixer, ref.animations.clips, ref.group.current);
    entityRef.current = ref.group.current;
  }, [animationController, convertMaterialsToBasic]);

  useWorldMapControls({
    worldmapMeshController,
    movementController,
    rotationController,
  });

  useFrame(({  scene}, delta) => {
    if (!entityRef.current) {
      return;
    }
    animationController.movementAnimationTick(movementController);

    movementController.tick(entityRef.current, delta, scene);
    animationController.tick(delta);

    entityRef.current.quaternion.identity();
    const meshUp = new Vector3(0, 0, 1).applyQuaternion(entityRef.current.quaternion).normalize();

    const raw256Angle = rotationController.getState().angle.get();
    const radians = (raw256Angle * Math.PI) / 128;

    entityRef.current.quaternion.setFromAxisAngle(meshUp, radians);
    entityRef.current.parent!.position.z = 0.9
  })


  return (
    <group userData={{
        movementController,
        rotationController
      }}>
      <group name="party--0">
        {/* @ts-expect-error Typing off when used here, but fine elsewhere? */}
        <SquallModel mapName={"bghoke_2"} ref={setModelRef} />
      </group>
    </group>
  )
}

export default Player;