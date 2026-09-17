import { Vector3 } from 'three'

import { WORLDMAP_STATE } from './state'

export const advanceScriptInputs = (padPresses: number, position: Vector3, previousPosition: undefined | Vector3) => {
  WORLDMAP_STATE.padPressed = padPresses
  WORLDMAP_STATE.isMoving = previousPosition !== undefined && !previousPosition.equals(position)
}

export const clearButtonInputLatch = () => {
  WORLDMAP_STATE.isButtonInputConsumed = false
}
