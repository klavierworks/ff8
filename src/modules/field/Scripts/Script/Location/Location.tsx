import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Mesh } from 'three'

import { CONTROLS_MAP } from '../../../../../constants/controls'
import useGlobalStore from '../../../../../store'
import LineBlock from '../../../LineBlock/LineBlock'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'
import useIntersection from '../useIntersection'
import { isValidActionableMethod } from '../utils'

type LocationProps = {
  scriptController: ReturnType<typeof createScriptController>
  useScriptStateStore: ScriptStateStore
}

const Location = ({ scriptController, useScriptStateStore }: LocationProps) => {
  const isLineOn = useScriptStateStore((state) => state.isLineOn)
  const linePoints = useScriptStateStore((state) => state.linePoints)

  const lineRef = useRef<Mesh>(null)
  const isTouchRunningRef = useRef(false)
  const isPushRunningRef = useRef(false)

  const hasValidTalkMethod = useMemo(() => {
    const talkMethod = scriptController.script.methods.find((method) => method.methodId === 'talk')
    if (!talkMethod) {
      return false
    }
    return isValidActionableMethod(talkMethod)
  }, [scriptController])

  const runRepeatingMethod = useCallback(
    (methodId: string, isRunningRef: React.MutableRefObject<boolean>) => {
      const method = scriptController.script.methods.find((candidate) => candidate.methodId === methodId)
      if (isRunningRef.current || !isValidActionableMethod(method)) {
        return
      }

      isRunningRef.current = true
      scriptController.triggerMethod(methodId).finally(() => {
        isRunningRef.current = false
      })
    },
    [scriptController],
  )

  const isUserControllable = useGlobalStore((state) => state.isUserControllable)

  const intersectionRef = useIntersection(
    isLineOn && isUserControllable,
    {
      onAcross: () => {
        scriptController.triggerMethod('across')
      },
      onFacing: () => runRepeatingMethod('push', isPushRunningRef),
      onRange: () => runRepeatingMethod('touch', isTouchRunningRef),
      onTouchOff: () => {
        scriptController.triggerMethod('touchoff')
      },
      onTouchOn: () => {
        scriptController.triggerMethod('touchon')
      },
    },
    linePoints ?? [],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { currentMessages, hasActiveTalkMethod, isUserControllable } = useGlobalStore.getState()
      const isTalkable = useScriptStateStore.getState().isTalkable
      const hasActiveText = currentMessages.length > 0

      const isPlayerAbleToTalk =
        isUserControllable && isTalkable && !hasActiveTalkMethod && hasValidTalkMethod && !hasActiveText

      if (!isPlayerAbleToTalk || !lineRef.current || !intersectionRef.current.isWithinInteractCone) {
        return
      }

      event.stopImmediatePropagation()
      if (event.code !== CONTROLS_MAP.confirm) {
        return
      }

      useGlobalStore.setState({ hasActiveTalkMethod: true })
      scriptController.triggerMethod('talk').then(() => {
        useGlobalStore.setState({ hasActiveTalkMethod: false })
      })
    },
    [hasValidTalkMethod, intersectionRef, scriptController, useScriptStateStore],
  )

  useEffect(() => {
    if (!isLineOn) {
      return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLineOn, onKeyDown])

  if (!linePoints || !isLineOn) {
    return null
  }

  return <LineBlock color={isLineOn ? 'blue' : 'grey'} lineBlockRef={lineRef} points={linePoints} renderOrder={0} />
}

export default Location
