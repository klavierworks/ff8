import { WORLDMAP_CONTROLS_MAP } from '../../../constants/controls'
import { WorldmapControlsState } from '../worldmapStore'

const axisFromKeys = (keys: ReadonlySet<string>, negative: string, positive: string) => {
  const negativeHeld = keys.has(negative)
  const positiveHeld = keys.has(positive)
  if (negativeHeld === positiveHeld) {
    return 0
  }
  return positiveHeld ? 1 : -1
}

export const deriveControlsState = (keys: ReadonlySet<string>): WorldmapControlsState => ({
  cameraPitch: axisFromKeys(keys, WORLDMAP_CONTROLS_MAP.cameraLookDown, WORLDMAP_CONTROLS_MAP.cameraLookUp),
  cameraYaw: axisFromKeys(keys, WORLDMAP_CONTROLS_MAP.cameraRotateRight, WORLDMAP_CONTROLS_MAP.cameraRotateLeft),
  isAccelerating: keys.has(WORLDMAP_CONTROLS_MAP.confirm),
  isBraking: keys.has(WORLDMAP_CONTROLS_MAP.card),
  isRunning: keys.has(WORLDMAP_CONTROLS_MAP.cancel),
  isWalkingSlow: keys.has(WORLDMAP_CONTROLS_MAP.walkModifier),
  moveX: axisFromKeys(keys, WORLDMAP_CONTROLS_MAP.left, WORLDMAP_CONTROLS_MAP.right),
  moveY: axisFromKeys(keys, WORLDMAP_CONTROLS_MAP.backward, WORLDMAP_CONTROLS_MAP.forward),
})

export const areControlsEqual = (a: WorldmapControlsState, b: WorldmapControlsState) =>
  a.moveX === b.moveX &&
  a.moveY === b.moveY &&
  a.cameraYaw === b.cameraYaw &&
  a.cameraPitch === b.cameraPitch &&
  a.isRunning === b.isRunning &&
  a.isWalkingSlow === b.isWalkingSlow &&
  a.isAccelerating === b.isAccelerating &&
  a.isBraking === b.isBraking
