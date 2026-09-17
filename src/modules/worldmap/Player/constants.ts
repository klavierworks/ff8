// ─── On-foot input ───
export const DPAD_MAGNITUDE = 127
export const DPAD_DIAGONAL_MAGNITUDE = 90

// ─── On-foot motion ───
export const VELOCITY_INPUT_MULTIPLIER = 16
export const VELOCITY_INPUT_SHIFT = 6
export const HEADING_SNAP_RANGE_PSX = 256
export const HEADING_TURN_STEP_PSX = 512

// ─── On-foot collision ───
export const SLIDE_ANGLE_STEP_PSX = 160
export const SLIDE_GROUP_COUNT = 8
export const SLIDE_PROBE_OFFSET_PSX = 32
export const BLOCKED_TICKS_BEFORE_OTHER_SLIDE_SET = 4

// ─── On-foot model ───
export const ON_FOOT_CHARAONE_SECTION = 0
export const ON_FOOT_TAG = 0
export const SPAWN_YAW_SCALE = 16

// ─── Frame order ───
export const INPUT_LATCH_FRAME_PRIORITY = -2
export const MOVEMENT_FRAME_PRIORITY = -1

// ─── Character animation ───
export const CLIP_STAND = 0
export const CLIP_RUN = 1
export const CLIP_FLOURISH = 2
export const CLIP_FLOURISH_FOLLOW_UP = 3
export const IDLE_START_ROLL_MASK = 0xfe
export const FLOURISH_HOLD_ROLL_MASK = 0xfc
export const ROLL_THRESHOLD_STEP = 13
export const SQUALL_MAX_ON_FOOT_TAG = 1

// ─── Chocobo rider animation ───
export const CLIP_RIDE_DISMOUNT = 4
export const CLIP_RIDE_STAND = 5
export const CLIP_RIDE_RUN = 6
export const CLIP_RIDE_FLOURISH = 7
export const RIDE_FLOURISH_ROLL_MASK = 0xfc

// ─── Ragnarok flight ───
export const RAGNAROK_BANK_SHIFT = 1
export const RAGNAROK_BANK_LIMIT = 256
export const RAGNAROK_BANK_RELAX_STEP = 32
export const RAGNAROK_ALTITUDE_GAIN = 120
export const RAGNAROK_ALTITUDE_SHIFT = 8
export const RAGNAROK_CEILING_ALTITUDE = -3584
export const RAGNAROK_GROUND_CLEARANCE = 200
export const RAGNAROK_BOX_HALF_SIZE = 256

// ─── Ragnarok transitions ───
export const RAGNAROK_TRANSITION_DIVISOR = 60
export const RAGNAROK_TRANSITION_LAST_TICK = 60
export const RAGNAROK_TAKEOFF_FOLD_TICKS = 40
export const RAGNAROK_FOLDED_FRAME = 319
export const RAGNAROK_FOLD_FRAME_STEP = 8
export const ANIMATION_SUBFRAMES_PER_KEYFRAME = 16

// ─── Ragnarok boarding and landing ───
export const RAGNAROK_BOARDING_REACH = 200
export const RAGNAROK_BOARDING_HEIGHT_TOLERANCE = 200
export const RAGNAROK_ACCESS_BIT = 0x80
export const LANDING_SPOT_DISTANCE = 528
export const LANDING_SPOT_HALF_SIZE = 32
export const LANDING_SPOT_FIRST_ANGLE = 1024
export const LANDING_SPOT_ANGLE_STEP = 512
export const LANDING_SPOT_TRIES = 8
export const LANDING_SPOT_HEIGHT_TOLERANCE = 200

// ─── Reserved entity slots ───
export const PARTY_ENTITY_SLOT = 0
export const CHOCOBO_ENTITY_SLOT = 1
export const CHICOBO_ENTITY_SLOT = 2
export const CAR_ENTITY_SLOT = 4
export const GARDEN_ENTITY_SLOTS = [5, 6] as const
