import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants'

// ─── Board + cards (320×224 UI space, top-left origin) ───
export const CARD_SIZE = 64
export const DISPLAY_PIXEL_ASPECT = (SCREEN_HEIGHT * 4) / (SCREEN_WIDTH * 3)
export const BOARD_IMAGE_WIDTH = 384
export const BOARD_COLUMN_CENTERS = [96, 160, 224]
export const BOARD_ROW_CENTERS = [48, 112, 176]

// ─── Hands ───
export const HAND_CARD_SCALE = 1
export const HAND_ROW_PITCH = 32 * HAND_CARD_SCALE
const HAND_ROW_TOP = 48
export const HAND_ROW_CENTERS = [0, 1, 2, 3, 4].map((row) => HAND_ROW_TOP + row * HAND_ROW_PITCH)
export const PLAYER_HAND_CENTER_X = 300
export const OPPONENT_HAND_CENTER_X = 20

// ─── Score ───
export const SCORE_DIGIT_SIZE = 24
export const PLAYER_SCORE_POSITION: [number, number] = [300, 204]
export const OPPONENT_SCORE_POSITION: [number, number] = [44, 204]

export const SELECTED_LIFT_X = 12
export const SELECTED_LIFT_Y = 6

// ─── Animation (30 FPS frame counts) ───
export const FLIP_FRAMES = 30
export const FLIP_ACTIVE_FRAMES = 25
export const FLIP_SWAP_FRAME = 12
export const PLACE_BOUNCE_FRAMES = 10
export const PLACE_BOUNCE_HEIGHT = 10
export const BANNER_IN_FRAMES = 5
export const BANNER_HOLD_FRAMES = 40
export const BANNER_OUT_FRAMES = 5
export const RESULT_BANNER_MS = 500

// ─── Who-goes-first spinner / turn cursor ───
export const SPINNER_VERTICES: [number, number, number][] = [
  [0, 8, 0],
  [0, 0, -8],
  [8, 0, -7],
  [-8, -4, 0],
]
export const SPINNER_FACES: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 1],
  [1, 3, 2],
]
export const SPINNER_SCALE = 1
export const SPINNER_REST_X = 160
export const SPINNER_REST_Y = 92
export const TURN_CURSOR_HAND_GAP = 40
export const SPINNER_WINNER_OFFSET_Y = 36
export const SPINNER_TOSS_FRAMES = 85
export const SPINNER_TOSS_ARC_FRAMES = 60
export const SPINNER_TOSS_HOLD_FRAMES = 10
export const SPINNER_WOBBLE_FRAMES = 30

// ─── Render order (no depth buffer; painter's order) ───
export const SCENE_Z = -10
export const RENDER_ORDER = {
  background: -2000,
  banner: -1000,
  boardCell: -1990,
  boardElement: -1980,
  cardBase: -1900,
  cursor: -1200,
} as const
export const CARD_LAYER = {
  element: 2,
  face: 1,
  number: 3,
  plate: 0,
} as const
export const SELECTED_RENDER_BOOST = 600
