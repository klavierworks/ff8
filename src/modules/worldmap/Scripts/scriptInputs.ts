import { Vector3 } from 'three'

import { WORLDMAP_STATE } from './state'

export const advanceScriptInputs = (padButtons: number, position: Vector3, previousPosition: undefined | Vector3) => {
  WORLDMAP_STATE.padPrevious = WORLDMAP_STATE.padCurrent
  WORLDMAP_STATE.padCurrent = padButtons
  WORLDMAP_STATE.isButtonInputConsumed = false
  WORLDMAP_STATE.isMoving = previousPosition !== undefined && !previousPosition.equals(position)
}
