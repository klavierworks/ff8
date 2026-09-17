import { WORLDMAP_CONTROLS_MAP, WORLDMAP_PAD_BITS } from '../../../constants/controls'
import { WorldmapControlsState } from '../worldmapStore'

const PAD_BUTTON_NAMES = Object.keys(WORLDMAP_PAD_BITS) as (keyof typeof WORLDMAP_PAD_BITS)[]

export const WATCHED_KEY_CODES = Object.values(WORLDMAP_CONTROLS_MAP)

const getDirectionPreferringNegative = (keys: ReadonlySet<string>, negative: string, positive: string) => {
  if (keys.has(negative)) {
    return -1
  }
  return keys.has(positive) ? 1 : 0
}

const getPadButtons = (keys: ReadonlySet<string>) =>
  PAD_BUTTON_NAMES.filter((name) => keys.has(WORLDMAP_CONTROLS_MAP[name])).reduce(
    (buttons, name) => buttons | WORLDMAP_PAD_BITS[name],
    0,
  )

export const getControlsState = (keys: ReadonlySet<string>): WorldmapControlsState => ({
  isAccelerating: keys.has(WORLDMAP_CONTROLS_MAP.confirm),
  isBraking: keys.has(WORLDMAP_CONTROLS_MAP.card),
  isRunning: keys.has(WORLDMAP_CONTROLS_MAP.cancel),
  isWalkingSlow: keys.has(WORLDMAP_CONTROLS_MAP.walkModifier),
  moveX: getDirectionPreferringNegative(keys, WORLDMAP_CONTROLS_MAP.left, WORLDMAP_CONTROLS_MAP.right),
  moveY: getDirectionPreferringNegative(keys, WORLDMAP_CONTROLS_MAP.backward, WORLDMAP_CONTROLS_MAP.forward),
  padButtons: getPadButtons(keys),
})
