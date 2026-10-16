import { useCallback, useEffect, useRef, useState } from 'react'

import { musicController } from './audio/activeMusicController'
import useFieldRevealStore, {
  acknowledgeFieldExit,
  beginFieldExit,
  cancelFieldExit,
  requestFieldIntro,
} from './modules/field/fieldRevealStore'
import { setIsSfxSuspended } from './modules/field/Scripts/Script/SFXController/webAudio'
import { preloadStartPoint } from './preloadStartPoint'
import useGlobalStore from './store'

type HostBridgeOptions = {
  hasIntroTransition: boolean
  isActive: boolean
  onExited?: () => void
  onReady?: () => void
}

const useReadyReport = (onReady: (() => void) | undefined, isPreloadNeeded: boolean) => {
  const hasReportedReadyRef = useRef(false)

  useEffect(() => {
    let isCurrent = true
    const preload = isPreloadNeeded ? preloadStartPoint() : Promise.resolve()
    preload.then(() => {
      if (!isCurrent || hasReportedReadyRef.current) {
        return
      }
      hasReportedReadyRef.current = true
      onReady?.()
    })
    return () => {
      isCurrent = false
    }
  }, [isPreloadNeeded, onReady])
}

const useAudioSuspension = (isPaused: boolean) => {
  useEffect(() => {
    musicController.setIsSuspended(isPaused)
    setIsSfxSuspended(isPaused)
  }, [isPaused])
}

// Before the first entry the game is not mounted; only the start point's files are fetched. Entering
// mounts it and plays the intro. Leaving plays the intro in reverse, then freezes the game and reports back.
const useHostBridge = ({ hasIntroTransition, isActive, onExited, onReady }: HostBridgeOptions) => {
  const [hasEntered, setHasEntered] = useState(isActive)
  const [isPreloadNeeded] = useState(!isActive)
  const [isExiting, setIsExiting] = useState(false)
  const wasActiveRef = useRef(isActive)
  const hasExited = useFieldRevealStore((state) => state.hasExited)

  const startExit = useCallback(() => {
    if (!hasIntroTransition) {
      onExited?.()
      return
    }
    setIsExiting(true)
    beginFieldExit()
  }, [hasIntroTransition, onExited])

  useEffect(() => {
    const wasActive = wasActiveRef.current
    wasActiveRef.current = isActive
    useGlobalStore.setState({ isEntranceHeld: !isActive })
    if (isActive) {
      setHasEntered(true)
      setIsExiting(false)
      cancelFieldExit()
      requestFieldIntro()
      return
    }
    if (wasActive) {
      startExit()
    }
  }, [isActive, startExit])

  useEffect(() => {
    if (!hasExited) {
      return
    }
    acknowledgeFieldExit()
    setIsExiting(false)
    onExited?.()
  }, [hasExited, onExited])

  useReadyReport(onReady, isPreloadNeeded)

  const isPaused = hasEntered && !isActive && !isExiting
  useAudioSuspension(isPaused)
  return { hasEntered, isPaused }
}

export default useHostBridge
