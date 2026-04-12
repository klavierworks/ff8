import { useEffect, useMemo, useRef } from "react";
import { Script as ScriptType } from "../types";
import Location from "./Location/Location";
import Model from "./Model/Model";
import useGlobalStore from "../../../store";
import Door from "./Door/Door";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import createScriptState from "./state";
import { createAnimationController } from "./AnimationController/AnimationController";
import createMovementController from "./MovementController/MovementController";
import createRotationController from "./RotationController/RotationController";
import createScriptController from "./ScriptController/ScriptController";
import createSFXController from "./SFXController/SFXController";
import { getPlayerEntity } from "./Model/modelUtils";
import { FieldData } from "../../Field";
import DrawPoint from "./DrawPoint/DrawPoint";

type ScriptProps = {
  doors: Door[];
  isActive: boolean;
  onSetupCompleted: () => void;
  onStarted?: () => void;
  models: string[];
  script: ScriptType;
  sounds: FieldData['sounds']
}

const Script = ({ doors, isActive, models, onSetupCompleted, onStarted, script, sounds }: ScriptProps) => {
  const entityRef = useRef<Group>(null);
  const scene = useThree(state => state.scene);
  const walkmeshController = useGlobalStore(state => state.walkmeshController);
  const useScriptStateStore = useMemo(() => createScriptState(script), [script]);
  const animationController = useMemo(() => createAnimationController(script.groupId), [script.groupId]);
  const movementController = useMemo(() => createMovementController(script.groupId, walkmeshController!), [script.groupId, walkmeshController]);
  const headController = useMemo(() => createRotationController(script.groupId, movementController, entityRef), [script.groupId, movementController]);
  const rotationController = useMemo(() => createRotationController(script.groupId, movementController, entityRef), [script.groupId, movementController]);
  const sfxController = useMemo(() => createSFXController(script.groupId, sounds ?? []), [script.groupId, sounds]);
  const scriptController = useMemo(() => createScriptController({
    animationController,
    headController,
    movementController,
    rotationController,
    sfxController,
    script,
    scene,
    useScriptStateStore,
  }), [animationController, headController, movementController, rotationController,sfxController, script, scene, useScriptStateStore]);

  const isVisible = useScriptStateStore(state => state.isVisible);
  const isDrawPoint = useScriptStateStore(state => state.isDrawPoint);
  const isUnused = useScriptStateStore(state => state.isUnused);
  const partyMemberId = useScriptStateStore(state => state.partyMemberId);
  
  const isTransitioningMap = useGlobalStore(state => !!state.pendingFieldId);

  const hasTriggeredConstructorRef = useRef<boolean>(false);
  const hasTriggeredDefaultRef = useRef<boolean>(false);
  useFrame(() => {
    if (!isActive && !hasTriggeredConstructorRef.current && entityRef.current) {
      hasTriggeredConstructorRef.current = true;
      scriptController.triggerMethod('constructor').then(() => {
        onSetupCompleted();
      })
    }
    if (!hasTriggeredDefaultRef.current && isActive) {
      hasTriggeredDefaultRef.current = true;
      scriptController.triggerMethod('default');
      onStarted?.();
    }
    if (isUnused && isActive) {
      return;
    }

    scriptController.tick();
  })

  useFrame((_, delta) => {
    const isTransitioningMap = !!useGlobalStore.getState().pendingFieldId;

    if (isTransitioningMap) {
      return;
    }

    animationController.tick(delta);
    animationController.movementAnimationTick(movementController);
  });

  useEffect(() => {
    if (isUnused) {
      return;
    }

    const handleExecutionRequest = async ({ detail: { key, scriptLabel, priority, isGuaranteed } }: {detail: ExecuteScriptEventDetail}) => {
      const matchingMethod = script.methods.find((method) => method.scriptLabel === scriptLabel);
      if (!matchingMethod) {
        return;
      }
      try {
        await scriptController.triggerMethod(matchingMethod.methodId, priority, true, isGuaranteed)
        document.dispatchEvent(new CustomEvent('scriptFinished', { detail: { key} }));
      } catch (error) {
        console.error('Error executing script:', error);
      }
    }
  
    document.addEventListener('executeScript', handleExecutionRequest);

    return () => {
      document.removeEventListener('executeScript', handleExecutionRequest);
    }
  }, [isUnused, script.methods, scriptController]);

  useEffect(() => {
    return () => {
      sfxController.stop();
    }
  }, [sfxController]);
  

  useEffect(() => {
    if (!isTransitioningMap) {
      return;
    }
    animationController.pauseAnimation(true);
    movementController.pause();
  }, [animationController, isTransitioningMap, movementController, useScriptStateStore]);

  const hasPausedMovement = useRef(false);
  useFrame(({ scene }, delta) => {
    if (!entityRef.current || script.type !== 'model') {
      return;
    }
    
    movementController.tick(entityRef.current, delta, scene);

    entityRef.current.quaternion.identity();
    const meshUp = new Vector3(0, 0, 1).applyQuaternion(entityRef.current.quaternion).normalize();

    const { isFacingTarget, waypoints } = movementController.getState().position
    if (waypoints && isFacingTarget) {
      rotationController.turnToFaceVector(waypoints[0], 0);
    }

    const isTalkingToPlayer = scriptController.isTalkingToPlayer();
    if (isTalkingToPlayer && !hasPausedMovement.current) {
      movementController.pause();
      hasPausedMovement.current = true;
    }

    if (!isTalkingToPlayer && hasPausedMovement.current) {
      movementController.resume();
      hasPausedMovement.current = false;
    }

    const raw256Angle = rotationController.getState().angle.get();
    const radians = (raw256Angle * Math.PI) / 128;

    entityRef.current.quaternion.setFromAxisAngle(meshUp, radians);

    if (useScriptStateStore.getState().isHeadTrackingPlayer) {
      const player = getPlayerEntity(scene);
      if (!player) {
        console.warn('Player character not found for head tracking');
        return;
      }
      headController.turnToFaceDirection(player.getWorldPosition(new Vector3()), 0);
    }
  });

  if (isUnused) {
    return null;
  }

  return (
    <group
      ref={entityRef}
      name={`entity--${script.groupId}`}
      userData={{
        animationController,
        hasBeenPlaced: false,
        scriptController,
        partyMemberId,
        movementController,
        rotationController,
        useScriptStateStore,
      }}
      position={script.type === 'model' ? [10,10,10] : [0,0,0]}
      visible={isVisible || isDrawPoint}
  >
      <group name={`party--${partyMemberId}`} userData={{ test: 'test' }}>
        {script.type === 'location' && <Location scriptController={scriptController} useScriptStateStore={useScriptStateStore} />}
        {script.type === 'model' && (
          isDrawPoint ?
          <DrawPoint scriptController={scriptController} useScriptStateStore={useScriptStateStore} />
          : <Model scriptController={scriptController} animationController={animationController} movementController={movementController} rotationController={rotationController} models={models} script={script} useScriptStateStore={useScriptStateStore} />
        )}
        {script.type === 'door' && <Door scriptController={scriptController} doors={doors} script={script} useScriptStateStore={useScriptStateStore} />}
      </group>
    </group>
  );
}

export default Script;