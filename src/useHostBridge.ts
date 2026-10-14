import { useCallback, useEffect, useRef, useState } from 'react'

import { musicController } from './audio/activeMusicController'
import useFieldLoadStore from './modules/field/fieldLoadStore'
import useFieldRevealStore, {
  acknowledgeFieldExit,
  beginFieldExit,
  cancelFieldExit,
  requestFieldIntro,
} from './modules/field/fieldRevealStore'
import { setIsSfxSuspended } from './modules/field/Scripts/Script/SFXController/webAudio'
import useGlobalStore from './store'

type HostBridgeOptions = {
  hasIntroTransition: boolean
  isActive: boolean
  onExited?: () => void
  onReady?: () => void
}

const useReadyReport = (onReady: (() => void) | undefined) => {
  const isFieldReady = useGlobalStore((state) => state.isFieldReady)
  const hasPendingLoads = useFieldLoadStore((state) => state.pendingLoadCount > 0)
  const isReady = isFieldReady && !hasPendingLoads
  const hasReportedReadyRef = useRef(false)

  useEffect(() => {
    if (!isReady || hasReportedReadyRef.current) {
      return
    }
    hasReportedReadyRef.current = true
    onReady?.()
  }, [isReady, onReady])
}

const useAudioSuspension = (isPaused: boolean) => {
  useEffect(() => {
    musicController.setIsSuspended(isPaused)
    setIsSfxSuspended(isPaused)
  }, [isPaused])
}

// Entering plays the intro. Leaving after an entry plays it in reverse, then freezes the game and
// reports back; before the first entry the game keeps running so the start field loads behind the host.
const useHostBridge = ({ hasIntroTransition, isActive, onExited, onReady }: HostBridgeOptions) => {
  const [hasEntered, setHasEntered] = useState(isActive)
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

  useReadyReport(onReady)

  const isPaused = hasEntered && !isActive && !isExiting
  useAudioSuspension(isPaused)
  return isPaused
}

export default useHostBridge
