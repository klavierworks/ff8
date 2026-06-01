import { Scene } from 'three'
import { create } from 'zustand'

import type { Script, ScriptMethod } from '../../types'
import type { OPCODE_HANDLERS } from '../handlers'

import { createAnimationController } from '../AnimationController/AnimationController'
import createHeadRotationController from '../HeadRotationController/HeadRotationController'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import createSFXController from '../SFXController/SFXController'
import createScriptState from '../state'

type QueueItem = {
  activeOpcodeIndex: number
  hasStarted: boolean
  isAwaiting: boolean
  isGuaranteed: boolean
  isLooping: boolean
  method: ScriptMethod
  priority: number
  uniqueId: string
}

type WaitMode = 'end' | 'start'

// Engine per-entity opcode budget per tick (sub_529FF0's `v19 = 16`).
const MAX_OPCODES_PER_TICK = 16

const createScriptController = ({
  animationController,
  handlers,
  headController,
  movementController,
  rotationController,
  scene,
  script,
  sfxController,
  useScriptStateStore,
}: {
  animationController: ReturnType<typeof createAnimationController>
  handlers: typeof OPCODE_HANDLERS
  headController: ReturnType<typeof createHeadRotationController>
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

  const triggerMethodByIndex = async (
    methodIndex: number,
    priority = 10,
    isGuaranteed = false,
    waitMode: WaitMode = 'end',
  ) => {
    const method = script.methods[methodIndex]
    if (!method) {
      console.trace(`Method with index ${methodIndex} not found in script for ${script.groupId}`)
      return
    }
    await triggerMethod(method.methodId, priority, true, isGuaranteed, waitMode)
  }

  const triggerMethod = async (
    methodId: string,
    priority = 10,
    canDuplicate = false,
    isGuaranteed = false,
    waitMode: WaitMode = 'end',
  ) => {
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
      hasStarted: false,
      isAwaiting: false,
      isGuaranteed,
      isLooping,
      method,
      priority,
      uniqueId,
    })

    const eventName = waitMode === 'start' ? 'scriptStart' : 'scriptEnd'
    return new Promise<void>((resolve) => {
      const handler = ({ detail }: { detail: string }) => {
        if (detail === uniqueId) {
          document.removeEventListener(eventName, handler)
          resolve()
        }
      }
      document.addEventListener(eventName, handler)
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

    const updatedQueueItem = [cleanActiveItem, ...cleanQueue].filter(Boolean)

    setState({ queue: updatedQueueItem })
  }

  const removeQueueItem = (uniqueId: string) => {
    const currentQueue = getState().queue
    const newQueue = currentQueue.filter((item) => item.uniqueId !== uniqueId)

    setState({
      queue: newQueue,
    })

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

  const setQueueItemFields = (uniqueId: string, fields: Partial<QueueItem>) => {
    const item = getState().queue.find((queued) => queued.uniqueId === uniqueId)
    if (!item) {
      return
    }
    updateQueueItem({ ...item, ...fields })
  }

  const resolveNextIndex = (item: QueueItem, nextIndex: number | void): 'remove' | number => {
    if (nextIndex === -2) {
      return 'remove'
    }
    if (nextIndex === -1) {
      return item.isLooping ? 0 : 'remove'
    }
    const resolved = nextIndex ?? item.activeOpcodeIndex + 1
    if (resolved >= item.method.opcodes.length) {
      return 'remove'
    }
    return resolved
  }

  // Drains opcodes for the active queue item until it blocks (an async opcode
  // such as MOVE/WAIT awaits), is preempted, or a run of synchronous opcodes
  // hits the per-tick budget. Mirrors the engine's per-entity loop (sub_529FF0):
  // up to 16 opcodes per tick, only yielding on an in-progress opcode. So the
  // tick a MOVE finishes, the following MSPEED + next MOVE run in the same tick
  // and multi-segment movement stays continuous instead of stuttering between
  // segments (which is what one-opcode-per-frame produced).
  const runOpcodes = async (uniqueId: string) => {
    setQueueItemFields(uniqueId, { isAwaiting: true })

    let synchronousOpcodes = 0
    for (;;) {
      const item = getState().queue.find((queued) => queued.uniqueId === uniqueId)
      if (!item || getState().queue[0]?.uniqueId !== uniqueId) {
        if (item) {
          setQueueItemFields(uniqueId, { isAwaiting: false })
        }
        return
      }

      if (!item.hasStarted) {
        document.dispatchEvent(new CustomEvent('scriptStart', { detail: uniqueId }))
        setQueueItemFields(uniqueId, { hasStarted: true })
      }

      const activeOpcode = item.method.opcodes[item.activeOpcodeIndex]

      if (activeOpcode.name.startsWith('LABEL')) {
        setQueueItemFields(uniqueId, { activeOpcodeIndex: item.activeOpcodeIndex + 1 })
        continue
      }
      if (activeOpcode.name === 'HALT') {
        removeQueueItem(uniqueId)
        return
      }

      let nextIndex: number | void
      let isBlocking = false
      try {
        const result = handlers[activeOpcode.name]({
          animationController,
          currentOpcode: activeOpcode,
          currentOpcodeIndex: item.activeOpcodeIndex,
          currentState: useScriptStateStore.getState(),
          headController,
          movementController,
          opcodes: item.method.opcodes,
          rotationController,
          scene,
          script,
          setState: useScriptStateStore.setState,
          sfxController,
          STACK,
          TEMP_STACK,
        })
        isBlocking = result instanceof Promise
        nextIndex = await result
      } catch (error) {
        console.error(`Error running opcode ${activeOpcode.name}:`, error)
        nextIndex = undefined
      }

      const latest = getState().queue.find((queued) => queued.uniqueId === uniqueId)
      if (!latest) {
        return
      }
      const resolved = resolveNextIndex(latest, nextIndex)
      if (resolved === 'remove') {
        removeQueueItem(uniqueId)
        return
      }
      setQueueItemFields(uniqueId, { activeOpcodeIndex: resolved })

      // Blocking opcodes already yielded a frame by awaiting, so reset the
      // budget; only an unbroken run of synchronous opcodes yields the tick.
      if (isBlocking) {
        synchronousOpcodes = 0
      } else if (++synchronousOpcodes >= MAX_OPCODES_PER_TICK) {
        setQueueItemFields(uniqueId, { isAwaiting: false })
        return
      }
    }
  }

  const tick = () => {
    const currentQueueItem = getState().queue[0]
    if (!currentQueueItem || currentQueueItem.isAwaiting) {
      return
    }
    void runOpcodes(currentQueueItem.uniqueId)
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
