import { useEffect, useRef, useState } from 'react'

import { musicController } from './audio/activeMusicController'
import useFieldLoadStore from './modules/field/fieldLoadStore'
import useFieldRevealStore, { acknowledgeFieldExit, requestFieldIntro } from './modules/field/fieldRevealStore'
import { setIsSfxSuspended } from './modules/field/Scripts/Script/SFXController/webAudio'
import useGlobalStore from './store'

type HostBridgeOptions = {
  isActive: boolean
  onExit?: () => void
  onReady?: () => void
}

const useEntranceHold = (isActive: boolean) => {
  useEffect(() => {
    useGlobalStore.setState({ isEntranceHeld: !isActive })
    if (isActive) {
      requestFieldIntro()
    }
  }, [isActive])
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

const useExitReport = (onExit: (() => void) | undefined) => {
  const hasExited = useFieldRevealStore((state) => state.hasExited)

  useEffect(() => {
    if (!hasExited) {
      return
    }
    acknowledgeFieldExit()
    onExit?.()
  }, [hasExited, onExit])
}

// Before the first activation the game must keep running so the start field loads behind the host.
// Once it has been entered, going inactive again freezes it.
const usePause = (isActive: boolean) => {
  const [hasEntered, setHasEntered] = useState(isActive)
  const isPaused = hasEntered && !isActive

  useEffect(() => {
    if (isActive) {
      setHasEntered(true)
    }
  }, [isActive])

  useEffect(() => {
    musicController.setIsSuspended(isPaused)
    setIsSfxSuspended(isPaused)
  }, [isPaused])

  return isPaused
}

const useHostBridge = ({ isActive, onExit, onReady }: HostBridgeOptions) => {
  useEntranceHold(isActive)
  useReadyReport(onReady)
  useExitReport(onExit)
  return usePause(isActive)
}

export default useHostBridge
