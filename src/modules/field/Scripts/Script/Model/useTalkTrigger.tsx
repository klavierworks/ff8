import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { CONTROLS_MAP } from '../../../../../constants/controls'
import useGlobalStore from '../../../../../store'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import { ScriptStateStore } from '../state'
import { findTalkTarget } from './interactionUtils'
import { getInteractiveEntities } from './modelUtils'

type useTalkTriggerProps = {
  isActive: boolean
  movementController: ReturnType<typeof createMovementController>
  rotationController: ReturnType<typeof createRotationController>
  useScriptStateStore: ScriptStateStore
}

const useTalkTrigger = ({
  isActive,
  movementController,
  rotationController,
  useScriptStateStore,
}: useTalkTriggerProps) => {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isTalk = event.code === CONTROLS_MAP.confirm
      const isCards = event.code === CONTROLS_MAP.card
      if (!isTalk && !isCards) {
        return
      }

      const { currentMessages, hasActiveTalkMethod, isUserControllable } = useGlobalStore.getState()
      if (!isUserControllable || hasActiveTalkMethod || currentMessages.length > 0) {
        return
      }

      const { hasBeenPlaced, position } = movementController.getState()
      if (!hasBeenPlaced) {
        return
      }

      const target = findTalkTarget(
        getInteractiveEntities(scene),
        position.current,
        rotationController.getState().angle.get(),
        useScriptStateStore.getState().pushRadius,
      )
      if (!target) {
        return
      }

      event.stopImmediatePropagation()

      useGlobalStore.setState({ hasActiveTalkMethod: true })
      target.scriptController.setTempVariable(0, isTalk ? 0 : 1)
      target.scriptController.triggerMethod('talk').then(() => {
        useGlobalStore.setState({ hasActiveTalkMethod: false })
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, movementController, rotationController, scene, useScriptStateStore])
}

export default useTalkTrigger
