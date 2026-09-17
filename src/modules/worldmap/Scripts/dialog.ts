import { closeMessage, openMessage } from '../../field/Scripts/Script/utils'
import { DIALOG_POSITION, DIALOG_STATE_PENDING } from './constants'

let dialogText: readonly string[] = []
let nextDialogSequence = 0
const openMessageIdsBySlot = new Map<number, string>()
const stringIdsBySlot = new Map<number, number>()
const slotStates = new Map<number, number>()

export const setDialogText = (text: readonly string[]) => {
  dialogText = text
}

const getDialogLine = (id: number) => dialogText[id] ?? `[missing dialog ${id}]`

export const getSlotState = (slot: number) => slotStates.get(slot) ?? DIALOG_STATE_PENDING

export const isDialogActive = (slot: number) =>
  openMessageIdsBySlot.has(slot) || getSlotState(slot) !== DIALOG_STATE_PENDING

const createDialogId = (slot: number) => `worldmap-${slot}-${Date.now()}-${nextDialogSequence++}`

const createSlotPlacement = (slot: number): MessagePlacement => ({
  ...DIALOG_POSITION,
  channel: slot,
  height: undefined,
  width: undefined,
})

export const isSlotAssigned = (slot: number, stringId: number) => stringIdsBySlot.get(slot) === stringId

export const showDialogText = (slot: number, text: string, placement: MessagePlacement, askOptions?: AskOptions) => {
  const id = createDialogId(slot)
  openMessageIdsBySlot.set(slot, id)
  slotStates.set(slot, DIALOG_STATE_PENDING)
  return openMessage(id, [text], placement, true, askOptions)
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

export const showDialog = (slot: number, stringId: number, askOptions?: AskOptions) => {
  stringIdsBySlot.set(slot, stringId)
  return showDialogText(slot, getDialogLine(stringId), createSlotPlacement(slot), askOptions)
}

export const closeDialog = (slot: number) => {
  slotStates.set(slot, DIALOG_STATE_PENDING)
  stringIdsBySlot.delete(slot)
  const id = openMessageIdsBySlot.get(slot)
  if (id === undefined) {
    return
  }
  openMessageIdsBySlot.delete(slot)
  closeMessage(id, undefined)
}

export const closeAllDialogs = () => {
  new Set([...stringIdsBySlot.keys(), ...openMessageIdsBySlot.keys()]).forEach(closeDialog)
  slotStates.clear()
}
