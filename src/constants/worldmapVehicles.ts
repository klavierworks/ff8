// ─── Worldmap vehicles: driving ───
export const DRIVING_INPUT_MAGNITUDE = 127
export const DRIVING_TURN_SHIFT = 2
export const DRIVING_HARD_TURN_SHIFT = 3
export const DRIVING_HARD_TURN_THRESHOLD = 511
export const DRIVING_CAMERA_LAG_SPEED_SHIFT = 3

export const RAGNAROK_DRIVING = {
  accelerationDivisor: 8,
  coastStep: 16,
  extraTurnShift: 0,
  hasCameraLagSpeedCap: true,
  topSpeed: 200,
} as const

export const CAR_DRIVING = {
  accelerationDivisor: 48,
  coastStep: 4,
  extraTurnShift: 0,
  hasCameraLagSpeedCap: false,
  topSpeed: 64,
} as const

export const GARDEN_DRIVING = {
  accelerationDivisor: 16,
  coastStep: 16,
  extraTurnShift: 1,
  hasCameraLagSpeedCap: false,
  topSpeed: 64,
} as const

// ─── Worldmap vehicles: ground ───
export const CAR_SLIDE_DRIFT_SHIFT = 3
export const GARDEN_SLIDE_DRIFT_SHIFT = 4
export const VEHICLE_PROBE_OFFSET_PSX = 64
export const CAR_ACCESS_BIT = 0x40
export const GARDEN_ACCESS_BIT = 0x20
export const CAR_LEAVE_BIT = 0x04
export const GARDEN_LEAVE_BIT = 0x02

// ─── Worldmap vehicles: Garden hover ───
export const GARDEN_HOVER_LOWEST_PSX = 128
export const GARDEN_HOVER_HIGHEST_PSX = 256
export const GARDEN_HOVER_STEP_PSX = 14
export const GARDEN_WATER_HOVER_OFFSET_PSX = 456
export const GARDEN_WATER_GROUND_MIN = 0x21
export const GARDEN_WATER_GROUND_MAX = 0x22

// ─── Worldmap vehicles: boarding ───
export const VEHICLE_BOARDING_HEIGHT_TOLERANCE = 200
export const CAR_DISEMBARK_DISTANCE = 256
export const GARDEN_DISEMBARK_DISTANCE = 700
export const GARDEN_LANDING_FRAMES = 30

// ─── Worldmap vehicles: rumble ───
export const CAR_PULL_AWAY_VIBRATION_PATTERN = 1
export const CAR_PULL_AWAY_VIBRATION_PRIORITY = 255

// ─── Worldmap vehicles: chocobo ───
export const CHOCOBO_ACCESS_BIT = 0x10
export const CHOCOBO_LEAVE_BIT = 0x01
export const CHOCOBO_VELOCITY_SHIFT = 5
export const CHOCOBO_DISMOUNT_DISTANCE = 0
export const CHOCOBO_DISMOUNT_SIDE_DISTANCE = 200
export const CHOCOBO_DISMOUNT_SIDE_ANGLE = -1024
export const CHOCOBO_DISMOUNT_TICKS = 64
export const CHOCOBO_DISMOUNT_FRAME_STEP = 12
export const CHOCOBO_DISMOUNT_FRAME_MAX = 799

// ─── Worldmap vehicles: chocobo run-off ───
export const CHOCOBO_RUN_OFF_START_FRAME = 400
export const CHOCOBO_RUN_OFF_SPEED = 48
export const CHOCOBO_RUN_OFF_WAYPOINT_REACH = 200
export const CHOCOBO_RUN_OFF_CANOPY_DEPTH = 80
export const CHOCOBO_PATH_MAX_LENGTH = 63
export const CHOCOBO_PATH_STEPS_PER_TICK = 16
export const CHOCOBO_PATH_HEADING_TRIES = 8
export const CHOCOBO_PATH_HEADING_STEP = 512
export const CHOCOBO_PATH_PROBE_DISTANCE = 24

// ─── Worldmap vehicles: chicobo trail ───
export const COMPANION_TRAIL_LENGTH = 16
export const COMPANION_TRAIL_LAG = 3
export const COMPANION_TRAIL_FIRST_WRITE_INDEX = 3
export const CHICOBO_ALTITUDE_LIMIT = 64
