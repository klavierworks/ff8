import { MEMORY } from '../../field/Scripts/Script/handlers'
import { WorldPosition } from '../types'
import useWorldmapStore from '../worldmapStore'
import { closeDialog, getSlotState, showDialog } from './dialog'
import { WorldmapOpcode } from './opcodes'
import { EntityRecord, getAllEntities, getEntity, isReservedSlot, pushSpawn, WORLDMAP_STATE } from './state'

type Handler = (args: HandlerArgs) => boolean | void

type HandlerArgs = {
  p1: number
  p2: number
  param: number
  position: WorldPosition
}

const VEHICLE_BOARDED_STATE: Partial<Record<number, number>> = { 48: 8, 50: 5 }
const VEHICLE_ENTERING_STATE: Partial<Record<number, number>> = { 48: 9, 50: 6 }

const noopAction: Handler = () => undefined
const noopCondition: Handler = () => false

const getBit = (value: number, bitIndex: number): number => (value >> bitIndex) & 1

const getBitFlag = (bit: number): number => {
  const word = bit < 32 ? WORLDMAP_STATE.bitFlags[0] : WORLDMAP_STATE.bitFlags[1]
  return (word >>> (bit & 31)) & 1
}

const setBitFlag = (bit: number, isSet: boolean | number) => {
  const wordIndex = bit < 32 ? 0 : 1
  const mask = 1 << (bit & 31)
  const previous = WORLDMAP_STATE.bitFlags[wordIndex]
  WORLDMAP_STATE.bitFlags[wordIndex] = isSet ? previous | mask : previous & ~mask
}

const toUint16 = (value: number): number => value & 0xffff

const TILE_MODE_SUB_TILE_COUNT = 4
const TILE_MODE_X_SHIFT = 11
const TILE_MODE_Y_STRIDE = 32

const packTileModeX = (tileX: number): number => (tileX % TILE_MODE_SUB_TILE_COUNT) << TILE_MODE_X_SHIFT

const packTileModeY = (tileY: number): number => (tileY % TILE_MODE_SUB_TILE_COUNT) << TILE_MODE_X_SHIFT

const packTileModeCoordinate = (tileX: number, tileY: number): number =>
  packTileModeX(tileX) + tileY * TILE_MODE_Y_STRIDE

const PSX_ANGLE_UNITS = 4096
const FACING_CONE_HALF_WIDTH = 1536

const LOCATION_FLAG_BIT = 3

const getButtonsChangedThisFrame = (current: number, previous: number, mask: number): number =>
  (current ^ previous) & mask

// Planar PSX squared-distance approximation of the original post-projection proximity test (~3000 PSX units).
const ENTITY_PROXIMITY_DISTANCE_SQUARED = 0x895440

const bearingFromPlayer = (entity: EntityRecord, position: WorldPosition): number => {
  const radians = Math.atan2(position.psxY - entity.positionY, entity.positionX - position.psxX)
  return Math.round((radians * PSX_ANGLE_UNITS) / (2 * Math.PI))
}

const isWithinFacingCone = (entity: EntityRecord, position: WorldPosition): boolean => {
  const raw = bearingFromPlayer(entity, position) - WORLDMAP_STATE.facingYaw
  const wrapped = ((raw % PSX_ANGLE_UNITS) + PSX_ANGLE_UNITS) % PSX_ANGLE_UNITS
  const delta = wrapped > PSX_ANGLE_UNITS / 2 ? wrapped - PSX_ANGLE_UNITS : wrapped
  return Math.abs(delta) <= FACING_CONE_HALF_WIDTH
}

export const OPCODE_HANDLERS: Partial<Record<WorldmapOpcode, Handler>> = {
  ADD_ENTITY: ({ p1, p2 }) => {
    pushSpawn(p1, p2)
  },
  ADD_ENTITY_ALT: ({ p1, p2 }) => {
    pushSpawn(p1, p2)
  },
  ADD_ITEM: noopAction,
  CHECK_BATTLE_RESULT: () => WORLDMAP_STATE.battleResult === 4,
  CHECK_BATTLE_STATE: ({ param }) => WORLDMAP_STATE.battleResult === param,
  CHECK_BATTLEVAR: noopCondition,
  CHECK_BIT_FLAG: ({ p1, p2 }) => getBitFlag(p1) === p2,
  CHECK_BUTTON_INPUT: ({ param }) => {
    if (WORLDMAP_STATE.isInputLocked) {
      return false
    }
    const { inputCurrent, inputPrevious } = WORLDMAP_STATE
    if (param === 0xffff) {
      return inputCurrent !== inputPrevious
    }
    return getButtonsChangedThisFrame(inputCurrent, inputPrevious, param) !== 0
  },
  CHECK_CHARACTER_DISTANCE: ({ param, position }) => {
    const index = WORLDMAP_STATE.looseCandidate
    const entity = getEntity(index)
    if (!entity || entity.typeCode !== param || isReservedSlot(index)) {
      return false
    }
    return isWithinFacingCone(entity, position)
  },
  CHECK_CHARACTER_LOCATION: ({ param }) => {
    const entity = getEntity(WORLDMAP_STATE.tightCandidate)
    return entity !== undefined && entity.typeCode === param
  },
  CHECK_CHARACTER_LOCATION_2: ({ param, position }) => {
    const entity = getEntity(WORLDMAP_STATE.looseCandidate)
    if (!entity || entity.typeCode !== param) {
      return false
    }
    return isWithinFacingCone(entity, position)
  },
  CHECK_CHARACTER_LOCATION_EX: ({ param }) => {
    const index = WORLDMAP_STATE.tightCandidate
    const entity = getEntity(index)
    return entity !== undefined && entity.typeCode === param && !isReservedSlot(index)
  },
  CHECK_COMBAT_SCENE_ID: ({ param }) => WORLDMAP_STATE.lastCombatSceneId === param,
  CHECK_DIALOG_CONFIRMED: ({ p1, p2 }) => {
    const isConfirmed = getSlotState(p1) >= 0 ? 1 : 0
    return p2 === isConfirmed
  },
  CHECK_DIALOG_STATE: ({ param }) => {
    const state = getSlotState(param)
    WORLDMAP_STATE.dialogChoice = state
    return state >= 0
  },
  CHECK_ENTITY_PROXIMITY: ({ param, position }) => {
    const entities = getAllEntities()
    for (let index = 0; index < entities.length; index++) {
      const entity = entities[index]
      if (entity.typeCode !== param) {
        continue
      }
      const dx = entity.positionX - position.psxX
      const dy = entity.positionY - position.psxY
      if (dx * dx + dy * dy <= ENTITY_PROXIMITY_DISTANCE_SQUARED) {
        return true
      }
    }
    return false
  },
  CHECK_LOCATION_DRAW_REGISTER: ({ param }) => {
    const diff = WORLDMAP_STATE.currentLocationIndex - WORLDMAP_STATE.previousLocationIndex - 1
    return toUint16(diff) === param
  },
  CHECK_LOCATION_FLAG: ({ param }) => getBit(WORLDMAP_STATE.currentLocationFlags, LOCATION_FLAG_BIT) === param,
  CHECK_MOVEMENT: ({ param }) => (WORLDMAP_STATE.isMoving ? 1 : 0) === param,
  CHECK_RANDOM_NUMBER: ({ param }) => Math.floor(Math.random() * 0x10000) < param,
  CHECK_REGION_NUMBER: ({ param, position }) => {
    if (WORLDMAP_STATE.isTileMode) {
      return param === packTileModeCoordinate(position.tileX, position.tileY)
    }
    return param === position.regionId
  },
  CHECK_TILE_POSITION: ({ param, position }) => param === position.tileX + 128 * position.tileY,
  CHECK_VEHICLE_BOARDED: ({ param }) => WORLDMAP_STATE.worldMapState === VEHICLE_BOARDED_STATE[param],
  CHECK_VEHICLE_ENTERING: ({ param }) => WORLDMAP_STATE.worldMapState === VEHICLE_ENTERING_STATE[param],
  CHECK_VEHICLE_TYPE: ({ param }) => param === useWorldmapStore.getState().vehicleId,
  CHECK_WORLD_MAP_STATE: ({ param }) => WORLDMAP_STATE.worldMapState === param,
  CLOSE_TEXT_BOX: ({ param }) => closeDialog(param),
  COMPARE_DIALOG_RESPONSE: ({ param }) => WORLDMAP_STATE.dialogChoice === param,
  COMPARE_LOCATION_BYTE: noopCondition,
  COMPARE_SCRIPT_VAR: ({ p1, p2 }) => p1 < 2 && WORLDMAP_STATE.scriptVars[p1 as 0 | 1] === p2,
  COMPARE_SCRIPT_VAR_GT: ({ p1, p2 }) => p1 < 2 && p2 > WORLDMAP_STATE.scriptVars[p1 as 0 | 1],
  COMPARE_SCRIPT_VAR_LT: ({ p1, p2 }) => p1 < 2 && p2 < WORLDMAP_STATE.scriptVars[p1 as 0 | 1],
  FAIL: noopCondition,
  GREATER_THAN: ({ param }) => param > (MEMORY[256] ?? 0),
  LTEQ_THAN: ({ param }) => param <= (MEMORY[256] ?? 0),
  SET_BIT_FLAG: ({ p1, p2 }) => {
    setBitFlag(p1, p2)
  },
  SET_GLOBAL_EVENT_TRIGGERED: () => {
    WORLDMAP_STATE.isGlobalEventTriggered = true
  },
  SET_SCRIPT_VAR: ({ p1, p2 }) => {
    if (p1 < 2) {
      WORLDMAP_STATE.scriptVars[p1 as 0 | 1] = p2
    }
  },
  SET_WORLD_MAP_STATE: ({ p1 }) => {
    WORLDMAP_STATE.worldMapState = p1
  },
  SHOW_CHOICE_BOX: ({ p1, p2 }) => {
    // The synchronous VM does not await this dialog; the choice lands in dialogChoice
    // asynchronously and is read back by a later opcode on a subsequent frame.
    showDialog(p1, p2, { blocked: undefined, cancel: undefined, default: undefined, first: 0, last: undefined }).then(
      (selectedIndex) => {
        WORLDMAP_STATE.dialogChoice = selectedIndex
      },
    )
  },
  SHOW_TEXT_BOX: ({ p1, p2 }) => {
    showDialog(p1, p2)
  },
  X_GREATER_THAN: ({ param, position }) => {
    if (WORLDMAP_STATE.isTileMode) {
      return param > packTileModeX(position.tileX)
    }
    return param > position.subSegmentX
  },
  X_LESS_THAN: ({ param, position }) => {
    if (WORLDMAP_STATE.isTileMode) {
      return param < packTileModeX(position.tileX)
    }
    return param < position.subSegmentX
  },
  Y_GREATER_THAN: ({ param, position }) => {
    if (WORLDMAP_STATE.isTileMode) {
      return param > packTileModeY(position.tileY)
    }
    return param > position.subSegmentY
  },
  Y_LESS_THAN: ({ param, position }) => {
    if (WORLDMAP_STATE.isTileMode) {
      return param < packTileModeY(position.tileY)
    }
    return param < position.subSegmentY
  },
}
