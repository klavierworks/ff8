import { Scene } from 'three'

import useGlobalStore from '../../../../store'
import { ScriptMethod } from '../types'
import { getPartyMemberModelComponent } from './Model/modelUtils'
import createScriptController from './ScriptController/ScriptController'

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const remoteExecute = async (
  scriptLabel: number,
  priority = 10,
  isGuaranteed = false,
  waitMode: 'end' | 'start' = 'end',
) =>
  new Promise<void>((resolve) => {
    const key = Math.random().toString(36).substring(7)

    const handler = ({ detail }: { detail: { key: string } }) => {
      if (detail.key !== key) {
        return
      }
      document.removeEventListener('scriptFinished', handler)
      resolve()
    }

    document.addEventListener('scriptFinished', handler)

    document.dispatchEvent(
      new CustomEvent('executeScript', {
        detail: {
          isGuaranteed,
          key,
          priority,
          scriptLabel,
          waitMode,
        } as ExecuteScriptEventDetail,
      }),
    )
  })

export const remoteExecutePartyMember = async (
  scene: Scene,
  partyMemberIndex: number,
  scriptLabel: number,
  priority = 10,
  isGuaranteed = false,
  waitMode: 'end' | 'start' = 'end',
) => {
  const actor = getPartyMemberModelComponent(scene, partyMemberIndex)
  if (!actor) {
    console.warn(`Party member index ${partyMemberIndex} not found`)
    return
  }

  const scriptController = actor.userData.scriptController as ReturnType<typeof createScriptController>

  if (!scriptController) {
    console.warn(`Script controller not found for party member ${partyMemberIndex}`)
    return
  }
  await scriptController.triggerMethodByIndex(scriptLabel, priority, isGuaranteed, waitMode)
}

export const openMessage = (
  id: string,
  text: string[],
  placement: MessagePlacement,
  isCloseable = true,
  askOptions?: AskOptions | undefined,
) =>
  new Promise<number>((resolve) => {
    const { currentMessages } = useGlobalStore.getState()

    const handleMessageClosed = ({ detail }: CustomEvent<{ id: string; selectedOption: number }>) => {
      if (detail.id !== id) {
        return
      }
      document.removeEventListener('messageClosed', handleMessageClosed as EventListener)
      resolve(detail.selectedOption)
    }
    document.addEventListener('messageClosed', handleMessageClosed as EventListener)
    useGlobalStore.setState({
      currentMessages: [
        ...currentMessages,
        {
          askOptions,
          id,
          isCloseable,
          placement,
          text,
        },
      ],
    })
  })

export const closeMessage = (id: string, selectedOptionIndex?: number) => {
  useGlobalStore.setState((state) => {
    const currentMessages = state.currentMessages.filter((message) => message.id !== id)
    return {
      ...state,
      currentMessages,
    }
  })

  document.dispatchEvent(
    new CustomEvent('messageClosed', {
      detail: {
        id,
        selectedOption: selectedOptionIndex,
      },
    }),
  )
}

export const enableMessageToClose = (id: string) => {
  useGlobalStore.setState((state) => {
    const currentMessages = state.currentMessages.map((message) => {
      if (message.id === id) {
        return {
          ...message,
          isCloseable: true,
        }
      }
      return message
    })
    return {
      ...state,
      currentMessages,
    }
  })
}

export const convert256ToRadians = (value: number) => ((value % 256) / 256) * 2 * Math.PI

export const isValidActionableMethod = (method?: ScriptMethod) => {
  if (!method) {
    return false
  }
  return (
    method.opcodes.filter(
      (opcode) =>
        !opcode.name.startsWith('LABEL') && opcode.name !== 'LBL' && opcode.name !== 'RET' && opcode.name !== 'HALT',
    ).length > 0
  )
}
