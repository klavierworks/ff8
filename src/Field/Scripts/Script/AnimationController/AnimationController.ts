import { AnimationAction, AnimationClip, AnimationMixer, Bone, Object3D } from "three";
import { create } from "zustand"
import { applyAnimationAtTime } from "./animationUtils";
import createMovementController from "../MovementController/MovementController";

type AnimationItem = {
  id: string;
  priority: number;

  action: AnimationAction
  clipId: number;

  startTime: number;
  endTime: number;

  direction: number;
  speed: number;

  isLooping: boolean;
  shouldHoldLastFrame: boolean;

  hasBeenZAdjusted: boolean;
  needsRealtimeZAdjustment: boolean;

  isFromMovement: boolean;
  isFromLadder: boolean;
}

type RunState = {
  direction: number;
  hasCompletedALoop: boolean;
  isComplete: boolean;
  time: number;
}

export const createAnimationController = (id: string | number) => {
  const {getState: getSavedAnimation, setState: setSavedAnimation } = create(() => ({
    standingId: 0,
    walkingId: 1,
    runningId: 2,

    ladderClimbId: 3,
    ladderTopId: 4,
    ladderBottomId: 5,
  }));

  const { getState, setState } = create(() => ({
    // We assume these three are always available due to initialize
    mixer: undefined as unknown as AnimationMixer,
    clips: [] as AnimationClip[],
    mesh: undefined as unknown as Object3D,

    activeAnimation: undefined as AnimationItem | undefined,
    animationSpeed: 16, // Default speed, can be adjusted later

    isPaused: false,
    isMovementTickEnabled: true,
  }));

  let currentRunState: RunState | undefined = undefined;

  const clearAnimation = () => {
    const mixer = getState().mixer;
    mixer.stopAllAction();
    mixer.update(0);
    setState({ activeAnimation: undefined });
  }

  const handleAnimationEnded = (uniqueId: string, shouldHoldLastFrame: boolean) => {
    if (!currentRunState) {
      return;
    }

    currentRunState.isComplete = true;

    const event = new CustomEvent('animationEnd', {
      detail: uniqueId
    });
    document.dispatchEvent(event);

    if (shouldHoldLastFrame) {
      return
    }
   
    clearAnimation();
  }

  const tick = (delta: number) => {
    const isPaused = getState().isPaused;
    if (isPaused) {
      return;
    }

    const activeAnimation = getState().activeAnimation;
    if (!activeAnimation) {
      return;
    }

    const { mixer, mesh } = getState();
    const { action, direction, startTime, endTime } = activeAnimation;

    action.enabled = true;
  
    // New run
    if (!currentRunState) {
      currentRunState = {
        hasCompletedALoop: false,
        isComplete: false,
        time: startTime,
        direction: direction,
      };
      applyAnimationAtTime(mesh, action.getClip(), startTime);
    }

    // Zero frames of animation, just set it to time
    if (startTime === endTime || action.getClip().duration === 0) {
      applyAnimationAtTime(mesh, action.getClip(), startTime);

      if (!currentRunState.isComplete) {
        handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame);
      }
      return;
    }

    // Animation has completed and holding last frame
    if (currentRunState.isComplete && activeAnimation.shouldHoldLastFrame) {
      applyAnimationAtTime(mesh, action.getClip(), endTime);
      return;
    }

    currentRunState.time += currentRunState.direction * delta;

    if (currentRunState.time >= endTime && activeAnimation.isLooping && direction === 1) {
      currentRunState.time = startTime;
      currentRunState.hasCompletedALoop = true;
    }
    
    if (currentRunState.time <= startTime && activeAnimation.isLooping && direction === -1) {
      currentRunState.time = endTime;
      currentRunState.hasCompletedALoop = true;
    }

    // Completed, clean it up
    if (currentRunState.time >= endTime && !activeAnimation.isLooping && direction === 1) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame);
      return;
    }
    if (currentRunState.time <= startTime && !activeAnimation.isLooping && direction === -1) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame);
      return;
    }

    action.time = currentRunState.time;
    action.paused = true;
    action.play()
    mixer.update(delta);
  }

  const playAnimation = (clipId: number, options?: {
      isLooping?: boolean;
      shouldHoldLastFrame?: boolean;
      startFrame?: number;
      endFrame?: number;
      priority?: number;
      speed?: number;
      direction?: number;
      needsRealtimeZAdjustment?: boolean;
      isFromMovement?: boolean;
      isFromLadder?: boolean;
    }) => {
    const clip = getState().clips[clipId]
    if (!clip) {
      if (!options || !options.isFromMovement) {
        console.warn(`Animation with ID ${clipId} not found for model ${id}`);
      }
      return;
    }

    const { mixer } = getState();
  
    const action = mixer.clipAction(clip);

    const frameRate = 30;

    const startTime =
      options?.startFrame !== undefined ? options.startFrame / frameRate : 0;
    const endTime =
      options?.endFrame !== undefined ? options.endFrame / frameRate : action.getClip().duration;

    const uniqueId =  `${id}-${clipId}--${Date.now()}`
    const animation: AnimationItem = {
      action,
      id: uniqueId,
      clipId,
      direction: 1,
      startTime,
      endTime,
      isLooping: options?.isLooping ?? false,
      shouldHoldLastFrame: options?.shouldHoldLastFrame ?? false,
      priority: options?.priority ?? 5,
      speed: options?.speed ?? 1,
      hasBeenZAdjusted: false,
      needsRealtimeZAdjustment: options?.needsRealtimeZAdjustment ?? true,
      isFromMovement: options?.isFromMovement ?? false,
      isFromLadder: options?.isFromLadder ?? false,
    }

    currentRunState = undefined;
    const currentlyActiveAnimation = getState().activeAnimation;
    if (currentlyActiveAnimation) {
      handleAnimationEnded(currentlyActiveAnimation.id, currentlyActiveAnimation.shouldHoldLastFrame);
      currentlyActiveAnimation.action.stop();
    }

    setState({
      activeAnimation: animation,
      isPaused: false,
    });

    return new Promise<void>((resolve) => {
      const handler = ({ detail }: { detail: string}) => {
        if (detail === uniqueId) {
          document.removeEventListener('animationEnd', handler);
          resolve();
        }
      };
      document.addEventListener('animationEnd', handler);
    })
  }

  const initialize = (mixer: AnimationMixer, clips: AnimationClip[], mesh: Object3D) => {
    setState({
      mixer,
      clips,
      mesh,
    })
    mixer.update(0);
  }

  const pauseAnimation = (shouldPause: boolean) => {
    setState({ isPaused: shouldPause });
  }

  const setAnimationSpeed = (speed: number) => setState({ animationSpeed: speed });

  const getIsSafeToMoveOn = () => {
    const activeAnimation = getState().activeAnimation;
    if (!activeAnimation) {
      return true;
    }
    if (activeAnimation && currentRunState?.isComplete) {
      return true;
    }
    if (activeAnimation.isLooping && currentRunState?.hasCompletedALoop) {
      return true;
    }
    return false;
  }

  const setIdleAnimations = (standingId: number, walkingId: number, runningId: number) => {
    setSavedAnimation({
      standingId,
      walkingId,
      runningId
    })

    if (getState().activeAnimation === undefined) {
      playMovementAnimation('standing');
    }
  }

  const getSavedAnimationId =  (type: 'standing' | 'walking' | 'running') => {
    const savedAnimations = getSavedAnimation();
    if (type === 'standing') {
      return savedAnimations.standingId;
    } else if (type === 'walking') {
      return savedAnimations.walkingId;
    } else if (type === 'running') {
      return savedAnimations.runningId;
    }
  }

  const playMovementAnimation = (animationName: 'standing' | 'walking' | 'running') => {
    const animationId = getSavedAnimationId(animationName);
    if (animationId === undefined) {
      return;
    }

    const { activeAnimation } = getState();

    if (animationId === activeAnimation?.clipId && activeAnimation?.isLooping) {
      return;
    }

    playAnimation(animationId, {
      isLooping: true,
      shouldHoldLastFrame: true,
      needsRealtimeZAdjustment: false,
      isFromMovement: true
    });
  }

  const isPlayingMovementAnimation = () => {
    const { activeAnimation } = getState();

    if (!activeAnimation) {
      return false;
    }

    if (!activeAnimation.isFromMovement) {
      return false;
    }

    return true;
  }

  const isSafeToApplyMovementAnimation = () => {
    const { activeAnimation } = getState();

    if (!activeAnimation) {
      return true;
    }

    if (activeAnimation.isFromMovement) {
      return true;
    }

    if (!activeAnimation.shouldHoldLastFrame && currentRunState?.isComplete) {
      return true;
    }

    return false;
  }

  const setHasAdjustedZ = (hasAdjustedZ: boolean) => {
    const activeAnimation = getState().activeAnimation;
    if (!activeAnimation) {
      return;
    }
    setState({
      activeAnimation: {
        ...activeAnimation,
        hasBeenZAdjusted: hasAdjustedZ,
      }
    })
  }

  const setLadderAnimation = (ladderAnimationId1: number, ladderAnimationId2: number, ladderAnimationId3: number) => {
    // Top and Bottom are not implemented
    setSavedAnimation({
      ladderTopId: ladderAnimationId3,
      ladderClimbId: ladderAnimationId2,
      ladderBottomId: ladderAnimationId1,
    })
  }

  const playLadderAnimation = async () => {
    return playAnimation(getSavedAnimation().ladderClimbId, {
      isLooping: true,
      shouldHoldLastFrame: false,
      needsRealtimeZAdjustment: false,
      isFromLadder: true
    });
  }

  const stopLadderAnimation = () => {
    const { activeAnimation } = getState();
    if (activeAnimation?.isFromLadder) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame);
    }
  }


  const movementAnimationTick = (movementController: ReturnType<typeof createMovementController>) => {
    const isMoving = movementController.isMoving();

    if (isMoving && currentRunState?.isComplete && getState().activeAnimation?.shouldHoldLastFrame) {
      clearAnimation();
    }
    if (!isSafeToApplyMovementAnimation()) {
      return;
    }
    
    if (!isMoving) {
      playMovementAnimation('standing');
      return;
    }
    
    const movementSpeed = movementController.getMovementSpeed();
    
    if (!movementSpeed) {
      playMovementAnimation('standing');
    } else if (movementSpeed > 3600) {
      playMovementAnimation('running');
    } else {
      playMovementAnimation('walking');
    }
  }

  return {
    tick,
    movementAnimationTick,
    playAnimation,
    initialize,
    setAnimationSpeed,
    getIsSafeToMoveOn,
    getSavedAnimation,
    setIdleAnimations,
    playMovementAnimation,
    getSavedAnimationId,
    setHasAdjustedZ,
    
    getState,
    isPlayingMovementAnimation,
    isSafeToApplyMovementAnimation,

    subscribe: () => {},
    pauseAnimation,
    // @eslint-disable-next-line @typescript-eslint/no-empty-function
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setHeadBone: (_head: Bone) => {},
    setLadderAnimation,
    playLadderAnimation,
    stopLadderAnimation,
  }
}