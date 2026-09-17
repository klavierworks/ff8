import { closeMessage, openMessage } from '../../field/Scripts/Script/utils'
import { DIALOG_POSITION, DIALOG_STATE_PENDING } from './constants'

let dialogText: readonly string[] = []
let nextDialogSequence = 0
const openMessageIdsBySlot = new Map<number, string>()
const slotStates = new Map<number, number>()

export const setDialogText = (text: readonly string[]) => {
  dialogText = text
}

const getDialogLine = (id: number) => dialogText[id] ?? `[missing dialog ${id}]`

export const getSlotState = (slot: number) => slotStates.get(slot) ?? DIALOG_STATE_PENDING

const createDialogId = (slot: number) => `worldmap-${slot}-${Date.now()}-${nextDialogSequence++}`

export const showDialog = (slot: number, stringId: number, askOptions?: AskOptions) => {
  const id = createDialogId(slot)
  openMessageIdsBySlot.set(slot, id)
  slotStates.set(slot, DIALOG_STATE_PENDING)
  const placement: MessagePlacement = { ...DIALOG_POSITION, channel: slot, height: undefined, width: undefined }
  return openMessage(id, [getDialogLine(stringId)], placement, true, askOptions)
    .then((selectedIndex) => {
      slotStates.set(slot, selectedIndex)
      return selectedIndex
    })
    .finally(() => {
      if (openMessageIdsBySlot.get(slot) === id) {
        openMessageIdsBySlot.delete(slot)
      }
    })
}

export const closeDialog = (slot: number) => {
  slotStates.set(slot, DIALOG_STATE_PENDING)
  const id = openMessageIdsBySlot.get(slot)
  if (id === undefined) {
    return
  }
  openMessageIdsBySlot.delete(slot)
  closeMessage(id, undefined)
}
