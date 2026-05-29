import { closeMessage, openMessage } from '../../field/Scripts/Script/utils'

const DIALOG_STATE_PENDING = -1

let dialogText: readonly string[] = []
let nextDialogSequence = 0
const openMessageIdsBySlot = new Map<number, string>()
const slotStates = new Map<number, number>()

export const setDialogText = (text: readonly string[]) => {
  dialogText = text
}

export const getDialogLine = (id: number): string => dialogText[id] ?? `[missing dialog ${id}]`

export const getSlotState = (slot: number): number => slotStates.get(slot) ?? DIALOG_STATE_PENDING

export const showDialog = (slot: number, stringId: number, askOptions?: AskOptions): Promise<number> => {
  const id = `worldmap-${slot}-${Date.now()}-${nextDialogSequence++}`
  openMessageIdsBySlot.set(slot, id)
  slotStates.set(slot, DIALOG_STATE_PENDING)
  const placement: MessagePlacement = { channel: slot, height: undefined, width: undefined, x: 5, y: 5 }
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
