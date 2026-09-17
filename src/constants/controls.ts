export const CONTROLS_MAP = {
  cancel: 'KeyX',
  card: 'KeyA',
  confirm: 'KeyZ',
  debug: 'Escape',
  menu: 'KeyS',
}

export const PSX_CONTROLS_MAP = {
  circle: CONTROLS_MAP.cancel,
  cross: CONTROLS_MAP.confirm,
  square: CONTROLS_MAP.card,
  triangle: CONTROLS_MAP.menu,
}

export const WORLDMAP_CONTROLS_MAP = {
  backward: 'ArrowDown',
  cameraRotateLeft: 'KeyQ',
  cameraRotateRight: 'KeyE',
  cancel: CONTROLS_MAP.cancel,
  card: CONTROLS_MAP.card,
  confirm: CONTROLS_MAP.confirm,
  debugPlaceRagnarok: 'KeyR',
  forward: 'ArrowUp',
  left: 'ArrowLeft',
  menu: CONTROLS_MAP.menu,
  pauseMenu: 'Enter',
  right: 'ArrowRight',
  runModifier: 'ShiftRight',
  toggleCameraMode: 'KeyV',
  toggleMinimap: 'KeyB',
  walkModifier: 'ShiftLeft',
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
