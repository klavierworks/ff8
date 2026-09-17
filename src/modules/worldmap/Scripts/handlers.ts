import type { ScriptOpcode } from './runScript'

import { VEHICLE_IDS } from '../../../constants/vehicles'
import { signExtend8, signExtend16 } from '../../../utils'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { TILES_PER_SEGMENT, WORLD_GRID_COLS } from '../constants'
import { radiansToPsx, shortestPsxDelta } from '../Player/playerAngles'
import { convertMapXToEntityX, convertMapZToEntityY } from '../Player/playerUtils'
import { WorldPosition } from '../types'
import { isCarClass, isTrainClass, isVehicleInRange } from '../vehicleClasses'
import { getFlagWordIndex, readSavedBattleState, readSavedFlagBit, readSavedScriptVariable } from '../worldmapSaveData'
import useWorldmapStore, {
  WORLD_MAP_STATE_GARDEN_LANDING,
  WORLD_MAP_STATE_GARDEN_TAKEOFF,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../worldmapStore'
import {
  ANY_BUTTON,
  BATTLE_STATE_BIT,
  ENTITY_PROXIMITY_DISTANCE_SQUARED,
  FACING_TOLERANCE,
  FIRST_PROXIMITY_ENTITY,
  FLAG_BIT_MASK,
  LOCATION_INDEX_MASK,
  RANDOM_NUMBER_RANGE,
  STORY_PROGRESS_HIGH_ADDRESS,
  STORY_PROGRESS_LOW_ADDRESS,
  TILE_MODE_OFFSET_SHIFT,
  TILE_POSITION_ROW_STRIDE,
  WON_BATTLE_RESULT,
} from './constants'
import { getSlotState } from './dialog'
import { OPCODE_NAMES, WorldmapOpcode } from './opcodes'
import {
  EntityRecord,
  getAllEntities,
  getEntity,
  isLocationTriggerSet,
  isOnFootCode,
  isReservedSlot,
  WORLDMAP_STATE,
} from './state'

type Condition = (opcode: ScriptOpcode, position: WorldPosition) => boolean

type ConditionResult = 'fail' | 'none' | 'pass'

type VehicleClassMatcher = (vehicleId: number) => boolean

const VEHICLE_LANDING_STATE: Partial<Record<number, number>> = {
  [VEHICLE_IDS.BALAMB_GARDEN]: WORLD_MAP_STATE_GARDEN_LANDING,
  [VEHICLE_IDS.RAGNAROK]: WORLD_MAP_STATE_RAGNAROK_LANDING,
}

const VEHICLE_TAKEOFF_STATE: Partial<Record<number, number>> = {
  [VEHICLE_IDS.BALAMB_GARDEN]: WORLD_MAP_STATE_GARDEN_TAKEOFF,
  [VEHICLE_IDS.RAGNAROK]: WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
}

const VEHICLE_CLASS_MATCHERS: Partial<Record<number, VehicleClassMatcher>> = {
  129: (vehicleId) => vehicleId < 2,
  130: (vehicleId) => isVehicleInRange(vehicleId, 8, 9),
  131: isTrainClass,
  132: isCarClass,
  133: (vehicleId) => isVehicleInRange(vehicleId, 34, VEHICLE_IDS.CAR_CLASS_MAX),
  [VEHICLE_IDS.BALAMB_GARDEN]: (vehicleId) => vehicleId === VEHICLE_IDS.BALAMB_GARDEN,
  [VEHICLE_IDS.BIKE]: (vehicleId) => vehicleId === VEHICLE_IDS.BIKE,
  [VEHICLE_IDS.CACTUAR]: (vehicleId) => vehicleId === VEHICLE_IDS.CACTUAR,
  [VEHICLE_IDS.ON_FOOT]: isOnFootCode,
  [VEHICLE_IDS.RAGNAROK]: (vehicleId) => vehicleId === VEHICLE_IDS.RAGNAROK,
}

const toFlag = (isSet: boolean) => (isSet ? 1 : 0)

const getStoryProgress = () =>
  (MEMORY[STORY_PROGRESS_LOW_ADDRESS] ?? 0) | ((MEMORY[STORY_PROGRESS_HIGH_ADDRESS] ?? 0) << 8)

const getBearingFromPlayer = (entity: EntityRecord, position: WorldPosition) =>
  Math.round(
    radiansToPsx(
      Math.atan2(
        entity.positionY - convertMapZToEntityY(position.psxY),
        entity.positionX - convertMapXToEntityX(position.psxX),
      ),
    ),
  )

const isSignedBearingWithinFacingTolerance = (entity: EntityRecord, position: WorldPosition) =>
  shortestPsxDelta(WORLDMAP_STATE.facingYaw, getBearingFromPlayer(entity, position)) <= FACING_TOLERANCE

const isVehicleClass = (vehicleClass: number) => {
  const matcher = VEHICLE_CLASS_MATCHERS[vehicleClass]
  return matcher ? matcher(useWorldmapStore.getState().vehicleId) : true
}

const isWorldMapState = (state: number | undefined) => useWorldmapStore.getState().worldMapState === state

const getPressedButtons = () => WORLDMAP_STATE.padCurrent & (WORLDMAP_STATE.padCurrent ^ WORLDMAP_STATE.padPrevious)

const isButtonInputPassing = (buttons: number) => {
  if (WORLDMAP_STATE.isTileMode) {
    return true
  }
  if (WORLDMAP_STATE.isButtonInputConsumed) {
    return false
  }
  const pressed = getPressedButtons()
  return buttons === ANY_BUTTON ? pressed !== 0 : (buttons & pressed) !== 0
}

const isEntityNearPlayer = (entity: EntityRecord, position: WorldPosition) => {
  const deltaX = signExtend16(entity.positionX - convertMapXToEntityX(position.psxX))
  const deltaZ = signExtend16(entity.positionY - convertMapZToEntityY(position.psxY))
  return deltaX * deltaX + deltaZ * deltaZ <= ENTITY_PROXIMITY_DISTANCE_SQUARED
}

const isNearEntityOfType = (typeCode: number, position: WorldPosition) =>
  getAllEntities()
    .slice(FIRST_PROXIMITY_ENTITY)
    .some((entity) => entity.typeCode === typeCode && isEntityNearPlayer(entity, position))

const isCandidateOfType = (index: number, typeCode: number) => getEntity(index)?.typeCode === typeCode

const isFacingCandidateOfType = (index: number, typeCode: number, position: WorldPosition) => {
  const entity = getEntity(index)
  return entity?.typeCode === typeCode && isSignedBearingWithinFacingTolerance(entity, position)
}

const getTileModeRegion = (position: WorldPosition) =>
  Math.floor(position.tileX / TILES_PER_SEGMENT) + WORLD_GRID_COLS * Math.floor(position.tileY / TILES_PER_SEGMENT)

const getTileModeOffset = (tile: number) => (tile % TILES_PER_SEGMENT) << TILE_MODE_OFFSET_SHIFT

const getPositionX = (position: WorldPosition) =>
  WORLDMAP_STATE.isTileMode ? getTileModeOffset(position.tileX) : position.subSegmentX

const getPositionY = (position: WorldPosition) =>
  WORLDMAP_STATE.isTileMode ? getTileModeOffset(position.tileY) : position.subSegmentY

const readScriptVariable = (index: number) => readSavedScriptVariable(MEMORY, signExtend8(index))

const CONDITIONS: Partial<Record<WorldmapOpcode, Condition>> = {
  CHECK_BATTLE_RESULT: ({ param }) => param === toFlag(WORLDMAP_STATE.battleResult === WON_BATTLE_RESULT),
  CHECK_BATTLE_STATE: ({ param }) =>
    WORLDMAP_STATE.isTileMode || (readSavedBattleState(MEMORY) & BATTLE_STATE_BIT) === param,
  CHECK_BATTLEVAR: () => false,
  CHECK_BIT_FLAG: ({ p1, p2, param }) => p2 === readSavedFlagBit(MEMORY, getFlagWordIndex(p1), param & FLAG_BIT_MASK),
  CHECK_BUTTON_INPUT: ({ param }) => isButtonInputPassing(param),
  CHECK_CHARACTER_DISTANCE: ({ param }, position) =>
    isFacingCandidateOfType(WORLDMAP_STATE.looseCandidate, param, position) &&
    !isReservedSlot(WORLDMAP_STATE.looseCandidate),
  CHECK_CHARACTER_LOCATION: ({ param }) => isCandidateOfType(WORLDMAP_STATE.tightCandidate, param),
  CHECK_CHARACTER_LOCATION_2: ({ param }, position) =>
    isFacingCandidateOfType(WORLDMAP_STATE.looseCandidate, param, position),
  CHECK_CHARACTER_LOCATION_EX: ({ param }) =>
    isCandidateOfType(WORLDMAP_STATE.tightCandidate, param) && !isReservedSlot(WORLDMAP_STATE.tightCandidate),
  CHECK_COMBAT_SCENE_ID: ({ param }) => WORLDMAP_STATE.lastCombatSceneId === param,
  CHECK_DIALOG_CONFIRMED: ({ p1, p2 }) => p2 === toFlag(getSlotState(p1) >= 0),
  CHECK_DIALOG_STATE: ({ param }) => {
    WORLDMAP_STATE.dialogChoice = getSlotState(param)
    return WORLDMAP_STATE.dialogChoice >= 0
  },
  CHECK_ENTITY_PROXIMITY: ({ param }, position) => isNearEntityOfType(param, position),
  CHECK_LOCATION_DRAW_REGISTER: ({ param }) =>
    ((WORLDMAP_STATE.currentLocationIndex - WORLDMAP_STATE.previousLocationIndex - 1) & LOCATION_INDEX_MASK) === param,
  CHECK_LOCATION_FLAG: ({ param }) => param !== toFlag(!isLocationTriggerSet()),
  CHECK_MOVEMENT: ({ param }) => param === toFlag(WORLDMAP_STATE.isMoving),
  CHECK_RANDOM_NUMBER: ({ param }) => Math.floor(Math.random() * RANDOM_NUMBER_RANGE) < param,
  CHECK_REGION_NUMBER: ({ param }, position) =>
    param === (WORLDMAP_STATE.isTileMode ? getTileModeRegion(position) : position.regionId),
  CHECK_TILE_POSITION: ({ param }, position) => param === position.tileX + TILE_POSITION_ROW_STRIDE * position.tileY,
  CHECK_VEHICLE_BOARDED: ({ param }) => isWorldMapState(VEHICLE_LANDING_STATE[param]),
  CHECK_VEHICLE_ENTERING: ({ param }) => isWorldMapState(VEHICLE_TAKEOFF_STATE[param]),
  CHECK_VEHICLE_TYPE: ({ param }) => WORLDMAP_STATE.isTileMode || isVehicleClass(param),
  CHECK_WORLD_MAP_STATE: ({ param }) => isWorldMapState(param),
  COMPARE_DIALOG_RESPONSE: ({ param }) => WORLDMAP_STATE.dialogChoice === param,
  COMPARE_LOCATION_BYTE: ({ p1 }) => p1 === WORLDMAP_STATE.locationTriangle?.groundType,
  COMPARE_SCRIPT_VAR: ({ p1, p2 }) => p2 === readScriptVariable(p1),
  COMPARE_SCRIPT_VAR_GT: ({ p1, p2 }) => p2 > readScriptVariable(p1),
  COMPARE_SCRIPT_VAR_LT: ({ p1, p2 }) => p2 < readScriptVariable(p1),
  FAIL: () => false,
  GREATER_THAN: ({ param }) => param > getStoryProgress(),
  LTEQ_THAN: ({ param }) => param <= getStoryProgress(),
  X_GREATER_THAN: ({ param }, position) => param > getPositionX(position),
  X_LESS_THAN: ({ param }, position) => param < getPositionX(position),
  Y_GREATER_THAN: ({ param }, position) => param > getPositionY(position),
  Y_LESS_THAN: ({ param }, position) => param < getPositionY(position),
}

export const checkCondition = (opcode: ScriptOpcode, position: WorldPosition): ConditionResult => {
  const name = OPCODE_NAMES[opcode.op]
  const condition = name ? CONDITIONS[name] : undefined
  if (!condition) {
    return 'none'
  }
  return condition(opcode, position) ? 'pass' : 'fail'
}
