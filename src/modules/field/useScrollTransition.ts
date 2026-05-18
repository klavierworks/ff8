import { useCallback, useRef } from "react";
import useGlobalStore from "../../store";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils } from "three";
import { framesToSeconds } from "../../timing";

const useScrollTransition = (type: 'camera' | 'layer', layerID?: number) => {
  const currentValue = useRef({
    positioning: 'camera' as ScrollPositionMode,
    progress: 0,
    x: 0,
    y: 0,
  })

  const transitionState = useRef({
    currentTransition: null as CameraScrollTransition | null,
    initialX: 0,
    initialY: 0,
    startTime: 0,
  })

  const getCurrentTransitionState = useCallback(() => {
    return type === 'layer'
      ? (useGlobalStore.getState().layerScrollOffsets[layerID!] ?? {})
      : useGlobalStore.getState().cameraScrollOffset
  }, [layerID, type])

  const setTransitionState = useCallback(
    (transition: CameraScrollTransition) => {
      if (type === 'layer') {
        useGlobalStore.setState({
          layerScrollOffsets: {
            ...useGlobalStore.getState().layerScrollOffsets,
            [layerID!]: transition,
          },
        })
      } else {
        useGlobalStore.setState({
          cameraScrollOffset: transition,
        })
      }
    },
    [layerID, type],
  )

  const invalidate = useThree(({ invalidate }) => invalidate)

  useFrame((state) => {
    const currentTransition = getCurrentTransitionState()

    if (!currentTransition.isInProgress) {
      return
    }

    if (currentTransition !== transitionState.current.currentTransition) {
      transitionState.current.currentTransition = currentTransition
      transitionState.current.initialX = currentValue.current.x
      transitionState.current.initialY = currentValue.current.y
      transitionState.current.startTime = state.clock.elapsedTime
    }

    const { startX, endX, startY, endY, duration, positioning } = transitionState.current.currentTransition;
    const elapsed = state.clock.elapsedTime - transitionState.current.startTime;
    const progress = duration === 0 ? 1 : Math.min(elapsed / framesToSeconds(duration), 1);

    const isSimpleLerp =
      (positioning === 'camera' && type === 'camera') || (positioning === 'level' && type === 'layer')
    if (isSimpleLerp) {
      currentValue.current.x = MathUtils.lerp(startX, endX, progress)
      currentValue.current.y = MathUtils.lerp(startY, endY, progress)
    } else {
      currentValue.current.x = MathUtils.lerp(transitionState.current.initialX, -endX, progress)
      currentValue.current.y = MathUtils.lerp(transitionState.current.initialY, -endY, progress)
    }

    currentValue.current.positioning = currentTransition.positioning
    currentValue.current.progress = progress
    invalidate()

    if (progress !== 1) {
      return
    }

    setTransitionState({
      ...currentTransition,
      isInProgress: false,
    })
  })

  return currentValue
}

export default useScrollTransition
