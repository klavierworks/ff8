import { Scene } from 'three'
import { create } from 'zustand'

import type { Script, ScriptMethod } from '../../types'
import type { OPCODE_HANDLERS } from '../handlers'

import useGlobalStore from '../../../../../store'
import { getScriptFrame } from '../../../scriptClock'
import { createAnimationController } from '../AnimationController/AnimationController'
import createFootstepController from '../FootstepController/FootstepController'
import createHeadRotationController from '../HeadRotationController/HeadRotationController'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import createSFXController from '../SFXController/SFXController'
import createScriptState from '../state'

type QueueItem = {
  activeOpcodeIndex: number
  hasStarted: boolean
  isAwaiting: boolean
  isLooping: boolean
  method: ScriptMethod
  priority: number
  queuedAtFrame: number
  tempStack: Record<number, number>
  uniqueId: string
}

type WaitMode = 'end' | 'start'

// Engine per-entity opcode budget per tick (16 in the original).
const MAX_OPCODES_PER_TICK = 16

// An entity's event methods are dispatched into fixed slots of its priority
// bank, counting down from slot 7 for method index 2 (talk, or a door's open)
// to slot 2 for method index 7 (touchon).
const EVENT_METHOD_SLOT_BASE = 9

const DEFAULT_METHOD_RANK = -1

const getEventMethodPriority = (methodIndex: number) => EVENT_METHOD_SLOT_BASE - methodIndex

const createScriptController = ({
  animationController,
  footstepController,
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
  footstepController: ReturnType<typeof createFootstepController>
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

  const { getState, setState } = create(() => ({
    queue: [] as QueueItem[],
    script,
  }))

  const ownerFieldId = useGlobalStore.getState().fieldId

  const triggerMethodByIndex = async (methodIndex: number, priority: number, waitMode: WaitMode = 'end') => {
    const method = script.methods[methodIndex]
    if (!method) {
      console.trace(`Method with index ${methodIndex} not found in script for ${script.groupId}`)
      return
    }
    await triggerMethod(method.methodId, priority, waitMode)
  }

  const triggerMethod = async (
    methodId: string,
    priority?: number,
    waitMode: WaitMode = 'end',
    initialTempStack: Record<number, number> = {},
  ) => {
    const methodIndex = script.methods.findIndex((method) => method.methodId === methodId)
    if (methodIndex === -1) {
      console.warn(`Method with id ${methodId} not found in script for ${script.groupId}`)
      return
    }

    const method = script.methods[methodIndex]
    const prioritySlot = priority ?? getEventMethodPriority(methodIndex)
    const uniqueId = `${script.groupId}-${methodId}--${prioritySlot}-${Date.now()}`

    const wasAccepted = addToQueue({
      activeOpcodeIndex: 0,
      hasStarted: false,
      isAwaiting: false,
      isLooping: method.methodId === 'default',
      method,
      priority: prioritySlot,
      queuedAtFrame: getScriptFrame(),
      tempStack: { ...initialTempStack },
      uniqueId,
    })

    if (!wasAccepted) {
      return
    }

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

  const getRank = (item: QueueItem) => (item.isLooping ? DEFAULT_METHOD_RANK : item.priority)

  const addToQueue = (newItem: QueueItem) => {
    const currentQueue = getState().queue

    if (currentQueue.some((item) => item.priority === newItem.priority)) {
      return false
    }

    const [runningItem, ...pendingItems] = currentQueue

    if (!runningItem || getRank(newItem) > getRank(runningItem)) {
      setState({ queue: [newItem, ...currentQueue] })
      return true
    }

    const insertAtIndex = pendingItems.findIndex((item) => getRank(item) < getRank(newItem))
    const orderedPendingItems =
      insertAtIndex === -1
        ? [...pendingItems, newItem]
        : [...pendingItems.slice(0, insertAtIndex), newItem, ...pendingItems.slice(insertAtIndex)]

    setState({ queue: [runningItem, ...orderedPendingItems] })
    return true
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
  // hits the per-tick budget. Mirrors the engine's per-entity loop:
  // up to 16 opcodes per tick, only yielding on an in-progress opcode. So the
  // tick a MOVE finishes, the following MSPEED + next MOVE run in the same tick
  // and multi-segment movement stays continuous instead of stuttering between
  // segments (which is what one-opcode-per-frame produced).
  const runOpcodes = async (uniqueId: string) => {
    setQueueItemFields(uniqueId, { isAwaiting: true })

    let synchronousOpcodes = 0
    for (;;) {
      // Ensure script exits if we change field
      if (useGlobalStore.getState().fieldId !== ownerFieldId) {
        return
      }

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
          footstepController,
          headController,
          movementController,
          opcodes: item.method.opcodes,
          rotationController,
          scene,
          script,
          setState: useScriptStateStore.setState,
          sfxController,
          STACK,
          TEMP_STACK: item.tempStack,
        })
        isBlocking = result instanceof Promise
        nextIndex = result instanceof Promise ? await result : result
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

  // A method requested on frame N starts on frame N+1, whatever order the
  // entities happen to tick in. REQSW/PREQSW block their caller until that
  // start, so the one-frame cost the scripts' WAIT counts compensate for holds.
  let lastTickedFrame = -1
  const tick = () => {
    const frame = getScriptFrame()
    if (frame === lastTickedFrame) {
      return
    }
    lastTickedFrame = frame

    const currentQueueItem = getState().queue[0]
    if (!currentQueueItem || currentQueueItem.isAwaiting || currentQueueItem.queuedAtFrame >= frame) {
      return
    }
    void runOpcodes(currentQueueItem.uniqueId)
  }

  const isTalkingToPlayer = () => getState().queue[0]?.method.methodId === 'talk'

  return {
    isTalkingToPlayer,
    script,
    tick,
    triggerMethod,
    triggerMethodByIndex,
  }
}

export default createScriptController
