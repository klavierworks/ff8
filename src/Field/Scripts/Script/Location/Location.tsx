import { useCallback, useMemo, useRef } from 'react'
import { Mesh } from 'three'

import { CONTROLS_MAP } from '../../../../constants/controls'
import useGlobalStore from '../../../../store'
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

  const hasValidTalkMethod = useMemo(() => {
    const talkMethod = scriptController.script.methods.find((method) => method.methodId === 'talk')
    if (!talkMethod) {
      return false
    }
    return isValidActionableMethod(talkMethod)
  }, [scriptController])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { currentMessages, hasActiveTalkMethod, isUserControllable } = useGlobalStore.getState()
      const isTalkable = useScriptStateStore.getState().isTalkable
      const hasActiveText = currentMessages.length > 0

      const isPlayerAbleToTalk =
        isUserControllable && isTalkable && !hasActiveTalkMethod && hasValidTalkMethod && !hasActiveText

      if (!isPlayerAbleToTalk || !lineRef.current) {
        return
      }

      event.stopImmediatePropagation()
      console.log(event.code, CONTROLS_MAP)
      if (event.code !== CONTROLS_MAP.confirm) {
        return
      }

      useGlobalStore.setState({ hasActiveTalkMethod: true })
      scriptController.triggerMethod('talk').then(() => {
        useGlobalStore.setState({ hasActiveTalkMethod: false })
      })
    },
    [hasValidTalkMethod, scriptController, useScriptStateStore],
  )

  const isUserControllable = useGlobalStore((state) => state.isUserControllable)

  useIntersection(
    lineRef,
    isLineOn && isUserControllable,
    {
      onAcross: () => {
        scriptController.triggerMethod('across')
      },
      onTouch: () => {
        const touchMethod = scriptController.script.methods.find((method) => method.methodId === 'touch')
        const hasValidTouchMethod = isValidActionableMethod(touchMethod)
        if (hasValidTouchMethod) {
          scriptController.triggerMethod('touch')
          return
        }
        const pushMethod = scriptController.script.methods.find((method) => method.methodId === 'push')
        const hasValidPushMethod = isValidActionableMethod(pushMethod)
        if (hasValidPushMethod) {
          scriptController.triggerMethod('push')
        }
      },
      onTouchOff: () => {
        window.removeEventListener('keydown', onKeyDown)
        scriptController.triggerMethod('touchoff')
      },
      onTouchOn: () => {
        window.addEventListener('keydown', onKeyDown)
        scriptController.triggerMethod('touchon')
      },
    },
    linePoints ?? [],
  )

  if (!linePoints || !isLineOn) {
    return null
  }

  return <LineBlock color={isLineOn ? 'blue' : 'grey'} lineBlockRef={lineRef} points={linePoints} renderOrder={0} />
}

export default Location
