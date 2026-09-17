import type { ScriptOpcode } from './runScript'

import { signExtend8 } from '../../../utils'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { addInventoryItem } from '../../field/Scripts/Script/utils'
import { getFlagWordIndex, writeSavedFlagBit, writeSavedScriptVariable } from '../worldmapSaveData'
import useWorldmapStore from '../worldmapStore'
import { EVENT_CHOICE_OPTIONS, FLAG_BIT_MASK, MAX_WRITABLE_SCRIPT_VARIABLE } from './constants'
import { closeDialog, isSlotAssigned, showDialog } from './dialog'
import { OPCODE_NAMES, WORLDMAP_OPCODES, WorldmapOpcode } from './opcodes'
import { WORLDMAP_STATE } from './state'

export type EventOutcome = { encounterId: number; kind: 'battle' } | { entranceIndex: number; kind: 'field' }

type EventAction = (opcode: ScriptOpcode) => void

const showTextBox = (slot: number, stringId: number) => {
  if (isSlotAssigned(slot, stringId)) {
    return
  }
  showDialog(slot, stringId)
}

const showChoiceBox = (slot: number, stringId: number) => {
  if (isSlotAssigned(slot, stringId)) {
    return
  }
  showDialog(slot, stringId, EVENT_CHOICE_OPTIONS)
}

const setWorldMapState = (worldMapState: number) => {
  if (useWorldmapStore.getState().worldMapState === worldMapState) {
    return
  }
  useWorldmapStore.setState({ worldMapState })
}

const writeScriptVariable = (index: number, value: number) => {
  if (index > MAX_WRITABLE_SCRIPT_VARIABLE) {
    return
  }
  writeSavedScriptVariable(MEMORY, index, value)
}

const EVENT_ACTIONS: Partial<Record<WorldmapOpcode, EventAction>> = {
  ADD_ITEM: ({ p1, p2 }) => addInventoryItem(p1, p2),
  CLOSE_TEXT_BOX: ({ param }) => closeDialog(param),
  CONSUME_BUTTON_INPUT: () => {
    WORLDMAP_STATE.isButtonInputConsumed = true
  },
  SET_BIT_FLAG: ({ p1, p2 }) =>
    writeSavedFlagBit(MEMORY, getFlagWordIndex(signExtend8(p1)), p1 & FLAG_BIT_MASK, p2 !== 0),
  SET_SCRIPT_VAR: ({ p1, p2 }) => writeScriptVariable(p1, p2),
  SET_WORLD_MAP_STATE: ({ p1 }) => setWorldMapState(p1),
  SHOW_CHOICE_BOX: ({ p1, p2 }) => showChoiceBox(signExtend8(p1), signExtend8(p2)),
  SHOW_TEXT_BOX: ({ p1, p2 }) => showTextBox(signExtend8(p1), p2),
}

const getOutcome = ({ op, param }: ScriptOpcode): EventOutcome | undefined => {
  if (op === WORLDMAP_OPCODES.RETURN_WITH_VALUE) {
    return { entranceIndex: param, kind: 'field' }
  }
  if (op === WORLDMAP_OPCODES.RETURN_WITH_CODE_3) {
    return { encounterId: param, kind: 'battle' }
  }
  return undefined
}

const runEventAction = (opcode: ScriptOpcode) => {
  const name = OPCODE_NAMES[opcode.op]
  const action = name ? EVENT_ACTIONS[name] : undefined
  action?.(opcode)
}

export const runEventScriptBody = (body: readonly ScriptOpcode[]) => {
  for (const opcode of body) {
    const outcome = getOutcome(opcode)
    if (outcome) {
      return outcome
    }
    runEventAction(opcode)
  }
  return undefined
}
