import { Scene } from 'three'
import { generateUUID } from 'three/src/math/MathUtils.js'
import { create } from 'zustand'

import type { Script, ScriptMethod } from '../../types'

import { sendToDebugger } from '../../../../Debugger/debugUtils'
import { createAnimationController } from '../AnimationController/AnimationController'
import { OPCODE_HANDLERS } from '../handlers'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import createSFXController from '../SFXController/SFXController'
import createScriptState from '../state'

type QueueItem = {
  activeOpcodeIndex: number
  isAwaiting: boolean
  isGuaranteed: boolean
  isLooping: boolean
  method: ScriptMethod
  priority: number
  uniqueId: string
}

const createScriptController = ({
  animationController,
  headController,
  movementController,
  rotationController,
  scene,
  script,
  sfxController,
  useScriptStateStore,
}: {
  animationController: ReturnType<typeof createAnimationController>
  headController: ReturnType<typeof createRotationController>
  movementController: ReturnType<typeof createMovementController>
  rotationController: ReturnType<typeof createRotationController>
  scene: Scene
  script: Script
  sfxController: ReturnType<typeof createSFXController>
  useScriptStateStore: ReturnType<typeof createScriptState>
}) => {
  const STACK: number[] = []
  const TEMP_STACK: Record<number, number> = {}

  const { getState, setState } = create(() => ({
    isProcessingAQueueItem: false,
    queue: [] as QueueItem[],
    script,
  }))

  const triggerMethodByIndex = async (methodIndex: number, priority = 10, isGuaranteed = false) => {
    const method = script.methods[methodIndex]
    if (!method) {
      console.trace(`Method with index ${methodIndex} not found in script for ${script.groupId}`)
      return
    }
    await triggerMethod(method.methodId, priority, isGuaranteed)
  }

  const triggerMethod = async (methodId: string, priority = 10, canDuplicate = false, isGuaranteed = false) => {
    const method = script.methods.find((method) => method.methodId === methodId)
    if (!method) {
      console.warn(`Method with id ${methodId} not found in script for ${script.groupId}`)
      return
    }

    const currentQueue = getState().queue
    if (!canDuplicate && currentQueue.find((item) => item.method.methodId === methodId)) {
      return
    }

    const uniqueId = `${script.groupId}-${methodId}--${priority}-${Date.now()}`
    const isLooping = method.methodId === 'default'

    addToQueue({
      activeOpcodeIndex: 0,
      isAwaiting: false,
      isGuaranteed,
      isLooping,
      method,
      priority,
      uniqueId,
    })

    return new Promise<void>((resolve) => {
      const handler = ({ detail }: { detail: string }) => {
        if (detail === uniqueId) {
          document.removeEventListener('scriptEnd', handler)
          resolve()
        }
      }
      document.addEventListener('scriptEnd', handler)
    })
  }

  const addToQueue = (newItem: QueueItem) => {
    const currentQueue = getState().queue

    const frozenQueue = [...currentQueue]
    const [activeItem] = frozenQueue

    if (newItem.isGuaranteed || !activeItem || (frozenQueue.length === 1 && activeItem.isLooping)) {
      setState({ queue: [newItem, ...currentQueue] })
      return
    }

    const [cleanActiveItem, ...cleanQueue] = frozenQueue.filter(
      (item) => item.method.methodId !== newItem.method.methodId || item.isGuaranteed,
    )
    const insertAtIndex = cleanQueue.findIndex((item) => item.priority > newItem.priority)
    const isTopPriority = insertAtIndex === -1

    if (isTopPriority) {
      cleanQueue.unshift(newItem)
    } else {
      cleanQueue.splice(insertAtIndex, 0, newItem)
    }

    sendToDebugger(
      'queue',
      JSON.stringify({
        id: script.groupId,
        opcode: `QUEUE: ADD ${newItem.uniqueId} ${newItem.method.methodId}`,
        uuid: generateUUID(),
      }),
    )

    const updatedQueueItem = [cleanActiveItem, ...cleanQueue].filter(Boolean)

    setState({ queue: updatedQueueItem })
  }

  const removeQueueItem = (uniqueId: string) => {
    const currentQueue = getState().queue
    const newQueue = currentQueue.filter((item) => item.uniqueId !== uniqueId)

    setState({
      queue: newQueue,
    })

    sendToDebugger(
      'queue',
      JSON.stringify({
        id: script.groupId,
        opcode: `QUEUE: ${uniqueId} complete`,
        uuid: generateUUID(),
      }),
    )

    const event = new CustomEvent('scriptEnd', {
      detail: uniqueId,
    })
    document.dispatchEvent(event)
  }

  const updateQueueItem = (queueItem: QueueItem) => {
    const currentQueue = getState().queue
    const newQueue = currentQueue.map((item) => {
      if (item.uniqueId === queueItem.uniqueId) {
        return queueItem
      }
      return item
    })
    setState({
      queue: newQueue,
    })
  }

  const tick = async () => {
    const { queue: __queue } = getState()
    const queueSnapshot = structuredClone(__queue)

    if (queueSnapshot.length === 0) {
      return
    }

    const queueItem = queueSnapshot[0]

    const { activeOpcodeIndex, isAwaiting, method, uniqueId } = queueItem

    if (isAwaiting) {
      return
    }

    updateQueueItem({
      ...queueItem,
      isAwaiting: true,
    })

    const activeOpcode = method.opcodes[activeOpcodeIndex]

    sendToDebugger(
      'command',
      JSON.stringify({
        id: script.groupId,
        opcode: `${activeOpcode.name} with param ${activeOpcode.param}. Index: ${activeOpcodeIndex}, method: ${method.methodId}`,
        uuid: generateUUID(),
      }),
    )

    if (activeOpcode.name.startsWith('LABEL')) {
      handleTickCleanup(queueItem.activeOpcodeIndex + 1, uniqueId)
      return
    }

    if (activeOpcode.name === 'HALT') {
      handleTickCleanup(-2, uniqueId)
      return
    }

    const opcodeHandler = OPCODE_HANDLERS[activeOpcode.name]
    const currentState = useScriptStateStore.getState()

    const promise = opcodeHandler({
      animationController,
      currentOpcode: activeOpcode,
      currentOpcodeIndex: activeOpcodeIndex,
      currentState,
      headController,
      movementController,
      opcodes: method.opcodes,
      rotationController,
      scene,
      script,
      setState: useScriptStateStore.setState,
      sfxController,
      STACK,
      TEMP_STACK,
    })

    // eslint-disable-next-line no-async-promise-executor
    new Promise<void>(async (resolve) => {
      const nextIndex = await Promise.race([promise])

      handleTickCleanup(nextIndex, uniqueId)
      sendToDebugger(
        'command',
        JSON.stringify({
          id: script.groupId,
          opcode: `Completed: ${activeOpcode.name}`,
          uuid: generateUUID(),
        }),
      )

      resolve()
    })
  }

  const handleTickCleanup = (nextIndex: number | void, uniqueId: string) => {
    const updatedQueueItem = getState().queue.find((item) => item.uniqueId === uniqueId)

    if (!updatedQueueItem) {
      return
    }

    if (nextIndex === -2) {
      removeQueueItem(uniqueId)
      return
    }

    if (nextIndex === -1 && !updatedQueueItem.isLooping) {
      removeQueueItem(uniqueId)
      return
    }

    if (nextIndex === -1) {
      updatedQueueItem.activeOpcodeIndex = 0
    }

    updatedQueueItem.activeOpcodeIndex = nextIndex ?? updatedQueueItem.activeOpcodeIndex + 1
    updatedQueueItem.isAwaiting = false

    if (updatedQueueItem.activeOpcodeIndex >= updatedQueueItem.method.opcodes.length) {
      removeQueueItem(uniqueId)
      return
    }

    updateQueueItem(updatedQueueItem)
  }

  const isTalkingToPlayer = () => getState().queue[0]?.method.methodId === 'talk'

  const setTempVariable = (key: number, value: number) => {
    TEMP_STACK[key] = value
  }

  return {
    isTalkingToPlayer,
    script,
    setTempVariable,
    tick,
    triggerMethod,
    triggerMethodByIndex,
  }
}

export default createScriptController
