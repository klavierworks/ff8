// ─── Worldmap trains: movement ───
export const TRAIN_CAR_COUNT = 5
export const TRAIN_RIDDEN_CAR_INDEX = 2
export const TRAIN_TOP_SPEED = 100
export const TRAIN_START_SPEED = 16
export const TRAIN_ACCELERATION = 4
export const TRAIN_BRAKING_WINDOW_POINTS = 3
export const TRAIN_BRAKING_SPEED_PER_POINT = 20
export const TRAIN_MIN_BRAKING_SPEED = 10
export const TRAIN_STOP_FRAMES = 30
export const TRAIN_HELD_STOP = -1
export const TRAIN_FRAME_STEP = 2
export const TRAIN_SEGMENT_FRACTION_SHIFT = 3
export const TRAIN_FREE_ROAM_RAILS = [0, 1] as const
export const TRAIN_RESEATING_RAIL = 1

// ─── Worldmap trains: player proximity ───
export const TRAIN_PROXIMITY_DISTANCE_SQUARED = 0x800000
export const TRAIN_PROXIMITY_SPEED_SCALE = 8
export const TRAIN_PROXIMITY_MIN_SPEED = 32

// ─── Worldmap trains: collision ───
export const TRAIN_COLLISION_STOP_FRAMES = 15
export const TRAIN_COLLISION_OFF_STATE = 13
export const TRAIN_COLLISION_REACH_SQUARED = 0x400000
export const TRAIN_RAGNAROK_PROBE_OFFSET_PSX = 256

// ─── Worldmap trains: cars ───
export const TRAIN_CAR_GAP = 16
export const TRAIN_CAR_LENGTH_TRIM = 128
export const TRAIN_CAR_LINKS = [1, 1, 0, -1, -1] as const

export const TRAIN_CAR_TYPES_BY_RAIL: readonly { end: number; middle: number }[] = [
  { end: 70, middle: 71 },
  { end: 70, middle: 71 },
  { end: 70, middle: 71 },
  { end: 70, middle: 71 },
  { end: 68, middle: 69 },
  { end: 68, middle: 69 },
  { end: 66, middle: 67 },
  { end: 70, middle: 71 },
  { end: 70, middle: 71 },
  { end: 66, middle: 67 },
  { end: 66, middle: 67 },
  { end: 66, middle: 67 },
  { end: 66, middle: 67 },
]

// ─── Worldmap trains: scripted rides ───
export const TRAIN_RAIL_COUNT = 14
export const TRAIN_STATION_LANDING_MIN = 64
export const TRAIN_STATION_LANDING_MAX = 67
export const TRAIN_UNSET_BYTE = 0xff
export const BOAT_RIDE_CAR_COUNT = 3
export const BOAT_RIDE_TOP_SPEED = 80
export const BOAT_RIDE_RIDDEN_CAR_INDEX = 1

export const RIDE_VEHICLE_ENTITY_TYPES: ReadonlyMap<number, number> = new Map([
  [65, 77],
  [66, 78],
])

// ─── Worldmap trains: stations ───
export const TRAIN_FARE = 3000
export const TRAIN_GIL_ADDRESS = 72
export const TRAIN_STORY_FLAGS_ADDRESS = 265
export const TRAIN_DISABLED_BIT = 0x01
export const TRAIN_STORY_HOLD_BIT = 0x40
export const TRAIN_DIALOG_SLOT = 0
export const TRAIN_NO_GIL_DIALOG_SLOT = 9
export const TRAIN_NO_GIL_MESSAGE = 10
export const TRAIN_GET_OFF_MESSAGES: readonly number[] = [4, 5, 6]
export const TRAIN_BOUND_FOR_FIRST_MESSAGE = 7
export const TRAIN_STATION_EXIT_VEHICLE = 21
export const TRAIN_RIDE_VEHICLE = 16
export const TRAIN_LAST_STATION_OF_RAIL_0 = 1
export const TRAIN_STATION_OF_RAIL_1 = 2
export const TRAIN_BOARDING_CAMERA_GROUPS: ReadonlyMap<number, number> = new Map([
  [64, 0],
  [65, 14],
  [66, 1],
  [67, 15],
])

// ─── Worldmap trains: line ends while riding ───
export const TRAIN_RAIL_0_FORWARD_EXIT = 53
export const TRAIN_RAIL_1_FORWARD_EXIT = 52
export const TRAIN_RAIL_1_BACKWARD_EXIT = 55

// ─── Worldmap trains: engine sound ───
export const TRAIN_ENGINE_SOUND_ID = 500003
export const TRAIN_ENGINE_AUDIBLE_DISTANCE_SQUARED = 0x7ffffff
export const TRAIN_ENGINE_DISTANCE_SHIFT = 7
export const TRAIN_ENGINE_SPEED_SHIFT = 2
export const TRAIN_ENGINE_MAX_VOLUME = 127

// ─── Worldmap trains: ride camera ───
export const RIDE_CAMERA_TRACK_END = -1
export const RIDE_CAMERA_PROGRESS_ONE = 4096
export const RIDE_CAMERA_STATION_MARKER = -2
export const RIDE_CAMERA_LERP_TO_NEXT = 1
export const RIDE_CAMERA_ABSOLUTE_ALTITUDE_ANCHOR = 12
export const RIDE_CAMERA_RELATIVE_ANCHOR = 7
