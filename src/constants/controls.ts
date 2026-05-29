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

// World_HandleInputs (0x5573c0) reads the PSX d-pad + face buttons for
// movement, the L2/R2 shoulder pair for camera yaw, Select for the minimap
// mode cycle, and Start for the pause/save menu. Walking and vehicle modes
// share the same physical inputs; the worldmap module decides which axis they
// drive.
export const WORLDMAP_CONTROLS_MAP = {
  backward: 'ArrowDown',
  cameraLookDown: 'PageDown',
  cameraLookUp: 'PageUp',
  cameraRotateLeft: 'KeyQ',
  cameraRotateRight: 'KeyE',
  cancel: CONTROLS_MAP.cancel,
  card: CONTROLS_MAP.card,
  confirm: CONTROLS_MAP.confirm,
  forward: 'ArrowUp',
  left: 'ArrowLeft',
  menu: CONTROLS_MAP.menu,
  pauseMenu: 'Enter',
  right: 'ArrowRight',
  runModifier: 'ShiftRight',
  toggleCameraMode: 'KeyV',
  toggleMinimap: 'KeyB',
  toggleRagnarok: 'KeyR',
  walkModifier: 'ShiftLeft',
}
