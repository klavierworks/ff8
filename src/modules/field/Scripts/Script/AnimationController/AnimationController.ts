import { AnimationAction, AnimationClip, AnimationMixer, Object3D } from "three";
import { create } from "zustand"
import { applyAnimationAtTime } from "./animationUtils";
import createMovementController from "../MovementController/MovementController";
import { framesToSeconds } from "../../../../../timing";

type AnimationItem = {
  action: AnimationAction
  clipId: number

  direction: number
  endTime: number

  hasBeenZAdjusted: boolean
  id: string

  isFromLadder: boolean
  isFromMovement: boolean

  isLooping: boolean
  needsRealtimeZAdjustment: boolean

  priority: number
  shouldHoldLastFrame: boolean

  speed: number
  startTime: number
}

type RunState = {
  direction: number
  hasCompletedALoop: boolean
  isComplete: boolean
  time: number
}

export const createAnimationController = (id: number | string) => {
  const { getState: getSavedAnimation, setState: setSavedAnimation } = create(() => ({
    ladderBottomId: 5,
    ladderClimbId: 3,
    ladderTopId: 4,

    runningId: 2,
    standingId: 0,
    walkingId: 1,
  }))

  const { getState, setState } = create(() => ({
    activeAnimation: undefined as AnimationItem | undefined,
    animationSpeed: 16, // Default speed, can be adjusted later
    clips: [] as AnimationClip[],

    isMovementTickEnabled: true,
    isPaused: false,

    mesh: undefined as unknown as Object3D,
    mixer: undefined as unknown as AnimationMixer,
  }))

  let currentRunState: RunState | undefined = undefined

  const clearAnimation = () => {
    const mixer = getState().mixer
    mixer.stopAllAction()
    mixer.update(0)
    setState({ activeAnimation: undefined })
  }

  const handleAnimationEnded = (uniqueId: string, shouldHoldLastFrame: boolean) => {
    if (!currentRunState) {
      return
    }

    currentRunState.isComplete = true

    const event = new CustomEvent('animationEnd', {
      detail: uniqueId,
    })
    document.dispatchEvent(event)

    if (shouldHoldLastFrame) {
      return
    }

    clearAnimation()
  }

  const tick = (delta: number) => {
    const isPaused = getState().isPaused
    if (isPaused) {
      return
    }

    const activeAnimation = getState().activeAnimation
    if (!activeAnimation) {
      return
    }

    const { mesh, mixer } = getState()
    const { action, direction, endTime, startTime } = activeAnimation

    action.enabled = true

    if (!currentRunState) {
      currentRunState = {
        direction: direction,
        hasCompletedALoop: false,
        isComplete: false,
        time: startTime,
      }
      applyAnimationAtTime(mesh, action.getClip(), startTime)
    }

    if (startTime === endTime || action.getClip().duration === 0) {
      applyAnimationAtTime(mesh, action.getClip(), startTime)

      if (!currentRunState.isComplete) {
        handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame)
      }
      return
    }

    if (currentRunState.isComplete && activeAnimation.shouldHoldLastFrame) {
      applyAnimationAtTime(mesh, action.getClip(), endTime)
      return
    }

    const animationSpeed = getState().animationSpeed

    // "Normal" animation speed is 16.
    currentRunState.time += currentRunState.direction * delta * (animationSpeed / 16)

    if (currentRunState.time >= endTime && activeAnimation.isLooping && direction === 1) {
      currentRunState.time = startTime
      currentRunState.hasCompletedALoop = true
    }

    if (currentRunState.time <= startTime && activeAnimation.isLooping && direction === -1) {
      currentRunState.time = endTime
      currentRunState.hasCompletedALoop = true
    }

    if (currentRunState.time >= endTime && !activeAnimation.isLooping && direction === 1) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame)
      return
    }
    if (currentRunState.time <= startTime && !activeAnimation.isLooping && direction === -1) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame)
      return
    }

    action.time = currentRunState.time
    action.paused = true
    action.play()
    mixer.update(delta)
  }

  const playAnimation = (
    clipId: number,
    options?: {
      direction?: number
      endFrame?: number
      isFromLadder?: boolean
      isFromMovement?: boolean
      isLooping?: boolean
      needsRealtimeZAdjustment?: boolean
      priority?: number
      shouldHoldLastFrame?: boolean
      speed?: number
      startFrame?: number
    },
  ) => {
    const clip = getState().clips[clipId]
    if (!clip) {
      if (!options || !options.isFromMovement) {
        console.warn(`Animation with ID ${clipId} not found for model ${id}`)
      }
      return
    }

    const { mixer } = getState()

    const action = mixer.clipAction(clip)

    const startTime =
      options?.startFrame !== undefined ? framesToSeconds(options.startFrame) : 0;
    const endTime =
      options?.endFrame !== undefined ? framesToSeconds(options.endFrame) : action.getClip().duration;

    const uniqueId = `${id}-${clipId}--${Date.now()}`
    const animation: AnimationItem = {
      action,
      clipId,
      direction: 1,
      endTime,
      hasBeenZAdjusted: false,
      id: uniqueId,
      isFromLadder: options?.isFromLadder ?? false,
      isFromMovement: options?.isFromMovement ?? false,
      isLooping: options?.isLooping ?? false,
      needsRealtimeZAdjustment: options?.needsRealtimeZAdjustment ?? true,
      priority: options?.priority ?? 5,
      shouldHoldLastFrame: options?.shouldHoldLastFrame ?? false,
      speed: options?.speed ?? 1,
      startTime,
    }

    currentRunState = undefined
    const currentlyActiveAnimation = getState().activeAnimation
    if (currentlyActiveAnimation) {
      handleAnimationEnded(currentlyActiveAnimation.id, currentlyActiveAnimation.shouldHoldLastFrame)
      currentlyActiveAnimation.action.stop()
    }

    setState({
      activeAnimation: animation,
      isPaused: false,
    })

    return new Promise<void>((resolve) => {
      const handler = ({ detail }: { detail: string }) => {
        if (detail === uniqueId) {
          document.removeEventListener('animationEnd', handler)
          resolve()
        }
      }
      document.addEventListener('animationEnd', handler)
    })
  }

  const initialize = (mixer: AnimationMixer, clips: AnimationClip[], mesh: Object3D) => {
    setState({
      clips,
      mesh,
      mixer,
    })
    mixer.update(0)
  }

  const pauseAnimation = (shouldPause: boolean) => {
    setState({ isPaused: shouldPause })
  }

  const setAnimationSpeed = (speed: number) => setState({ animationSpeed: speed })

  const getIsSafeToMoveOn = () => {
    const activeAnimation = getState().activeAnimation
    if (!activeAnimation) {
      return true
    }
    if (activeAnimation && currentRunState?.isComplete) {
      return true
    }
    if (activeAnimation.isLooping && currentRunState?.hasCompletedALoop) {
      return true
    }
    return false
  }

  const setIdleAnimations = (standingId: number, walkingId: number, runningId: number) => {
    setSavedAnimation({
      runningId,
      standingId,
      walkingId,
    })

    if (getState().activeAnimation === undefined) {
      playMovementAnimation('standing')
    }
  }

  const getSavedAnimationId = (type: 'running' | 'standing' | 'walking') => {
    const savedAnimations = getSavedAnimation()
    if (type === 'standing') {
      return savedAnimations.standingId
    } else if (type === 'walking') {
      return savedAnimations.walkingId
    } else if (type === 'running') {
      return savedAnimations.runningId
    }
  }

  const playMovementAnimation = (animationName: 'running' | 'standing' | 'walking') => {
    const animationId = getSavedAnimationId(animationName)
    if (animationId === undefined) {
      return
    }

    const { activeAnimation } = getState()

    if (animationId === activeAnimation?.clipId && activeAnimation?.isLooping) {
      return
    }

    playAnimation(animationId, {
      isFromMovement: true,
      isLooping: true,
      needsRealtimeZAdjustment: false,
      shouldHoldLastFrame: true,
    })
  }

  const isPlayingMovementAnimation = () => {
    const { activeAnimation } = getState()

    if (!activeAnimation) {
      return false
    }

    if (!activeAnimation.isFromMovement) {
      return false
    }

    return true
  }

  const isSafeToApplyMovementAnimation = () => {
    const { activeAnimation } = getState()

    if (!activeAnimation) {
      return true
    }

    if (activeAnimation.isFromMovement) {
      return true
    }

    if (!activeAnimation.shouldHoldLastFrame && currentRunState?.isComplete) {
      return true
    }

    return false
  }

  const setHasAdjustedZ = (hasAdjustedZ: boolean) => {
    const activeAnimation = getState().activeAnimation
    if (!activeAnimation) {
      return
    }
    setState({
      activeAnimation: {
        ...activeAnimation,
        hasBeenZAdjusted: hasAdjustedZ,
      },
    })
  }

  const setLadderAnimation = (ladderAnimationId1: number, ladderAnimationId2: number, ladderAnimationId3: number) => {
    setSavedAnimation({
      ladderBottomId: ladderAnimationId1,
      ladderClimbId: ladderAnimationId2,
      ladderTopId: ladderAnimationId3,
    })
  }

  const playLadderAnimation = async () => {
    return playAnimation(getSavedAnimation().ladderClimbId, {
      isFromLadder: true,
      isLooping: true,
      needsRealtimeZAdjustment: false,
      shouldHoldLastFrame: false,
    })
  }

  const stopLadderAnimation = () => {
    const { activeAnimation } = getState()
    if (activeAnimation?.isFromLadder) {
      handleAnimationEnded(activeAnimation.id, activeAnimation.shouldHoldLastFrame)
    }
  }

  const movementAnimationTick = (movementController: ReturnType<typeof createMovementController>) => {
    const isMoving = movementController.isMoving()

    if (isMoving && currentRunState?.isComplete && getState().activeAnimation?.shouldHoldLastFrame) {
      clearAnimation()
    }
    if (!isSafeToApplyMovementAnimation()) {
      return
    }

    if (!isMoving) {
      playMovementAnimation('standing')
      return
    }

    const movementSpeed = movementController.getMovementSpeed()

    if (!movementSpeed) {
      playMovementAnimation('standing')
    } else if (movementSpeed >= 2696) {
      playMovementAnimation('running')
    } else {
      playMovementAnimation('walking')
    }
  }

  return {
    getIsSafeToMoveOn,
    getSavedAnimation,
    getSavedAnimationId,
    getState,
    initialize,
    isPlayingMovementAnimation,
    isSafeToApplyMovementAnimation,
    movementAnimationTick,
    pauseAnimation,
    playAnimation,
    playLadderAnimation,

    playMovementAnimation,
    setAnimationSpeed,
    setHasAdjustedZ,
    setIdleAnimations,
    setLadderAnimation,
    stopLadderAnimation,
    subscribe: () => {},
    tick,
  }
}
