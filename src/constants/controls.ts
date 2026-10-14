export const CONTROLS_MAP = {
  cancel: 'KeyX',
  card: 'KeyA',
  confirm: 'KeyZ',
  debug: 'Escape',
  l1: 'KeyQ',
  menu: 'KeyS',
  r1: 'KeyE',
  select: 'KeyB',
  start: 'Enter',
  walk: 'ShiftLeft',
}

export const PSX_CONTROLS_MAP = {
  circle: CONTROLS_MAP.cancel,
  cross: CONTROLS_MAP.confirm,
  l1: CONTROLS_MAP.l1,
  r1: CONTROLS_MAP.r1,
  select: CONTROLS_MAP.select,
  square: CONTROLS_MAP.card,
  start: CONTROLS_MAP.start,
  triangle: CONTROLS_MAP.menu,
}

export const WORLDMAP_CONTROLS_MAP = {
  backward: 'ArrowDown',
  cameraRotateLeft: CONTROLS_MAP.l1,
  cameraRotateRight: CONTROLS_MAP.r1,
  cancel: CONTROLS_MAP.cancel,
  card: CONTROLS_MAP.card,
  confirm: CONTROLS_MAP.confirm,
  debugPlaceRagnarok: 'KeyR',
  forward: 'ArrowUp',
  left: 'ArrowLeft',
  menu: CONTROLS_MAP.menu,
  pauseMenu: CONTROLS_MAP.start,
  right: 'ArrowRight',
  runModifier: 'ShiftRight',
  toggleCameraMode: 'KeyV',
  toggleMinimap: CONTROLS_MAP.select,
  walkModifier: CONTROLS_MAP.walk,
}

export const WORLDMAP_PAD_BITS = {
  backward: 0x4000,
  cameraRotateLeft: 0x4,
  cameraRotateRight: 0x8,
  cancel: 0x10,
  card: 0x80,
  confirm: 0x40,
  forward: 0x1000,
  left: 0x8000,
  menu: 0x20,
  pauseMenu: 0x800,
  right: 0x2000,
  toggleCameraMode: 0x2,
  toggleMinimap: 0x100,
} satisfies Partial<Record<keyof typeof WORLDMAP_CONTROLS_MAP, number>>

export const TOUCH_FACE_BUTTONS = ['triangle', 'circle', 'cross', 'square'] as const
export const TOUCH_SHOULDER_BUTTONS = ['l1', 'r1'] as const
export const TOUCH_SYSTEM_BUTTONS = ['select', 'start'] as const

export const TOUCH_STICK_SECTOR_KEYS = [
  ['ArrowRight'],
  ['ArrowRight', 'ArrowUp'],
  ['ArrowUp'],
  ['ArrowLeft', 'ArrowUp'],
  ['ArrowLeft'],
  ['ArrowDown', 'ArrowLeft'],
  ['ArrowDown'],
  ['ArrowDown', 'ArrowRight'],
] as const

export const TOUCH_STICK_RADIUS = 52
export const TOUCH_STICK_DEADZONE = 0.25
export const TOUCH_STICK_WALK_THRESHOLD = 0.65
export const TOUCH_STICK_SECTOR_HYSTERESIS = 0.15
export const TOUCH_BUTTON_HIT_SLOP = 14
export const TOUCH_HAPTIC_PULSE = 8
