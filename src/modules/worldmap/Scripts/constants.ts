// ─── Scripts: dialog ───
export const DIALOG_STATE_PENDING = -1
export const DIALOG_POSITION = { x: 5, y: 5 } as const

// ─── Scripts: interpreter ───
export const SCRIPT_OPCODE_SIZE = 4
export const MAX_STEPS_PER_SCRIPT_FACTOR = 4
export const OPCODE_PARAM_HIGH_BYTE_FACTOR = 256

// ─── Scripts: location ───
export const LOCATION_TRIGGER_BIT = 0x08
export const LOCATION_INDEX_MASK = 0xffff
export const LOCATION_SCRIPT_ENTRY_DELAY_FRAMES = 24

// ─── Scripts: conditions ───
export const TILE_MODE_OFFSET_SHIFT = 11
export const TILE_POSITION_ROW_STRIDE = 128
export const FACING_TOLERANCE = 512
export const ENTITY_PROXIMITY_DISTANCE_SQUARED = 0x895440
export const FIRST_PROXIMITY_ENTITY = 1
export const ANY_BUTTON = 0xffff
export const WON_BATTLE_RESULT = 4
export const BATTLE_STATE_BIT = 1
export const FLAG_BIT_MASK = 0x1f
export const RANDOM_NUMBER_RANGE = 0x10000
export const STORY_PROGRESS_LOW_ADDRESS = 256
export const STORY_PROGRESS_HIGH_ADDRESS = 257
