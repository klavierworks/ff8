import { useRef } from 'react'

import {
  CAR_PULL_AWAY_VIBRATION_PATTERN,
  CAR_PULL_AWAY_VIBRATION_PRIORITY,
} from '../../../../constants/worldmapVehicles'
import { isVibrationPlaying, startVibration, VIBRATION_NOT_STARTED } from '../../../../vibration'
import useScriptTick from '../../useScriptTick'
import { isCarClass } from '../../vehicleClasses'
import useWorldmapStore from '../../worldmapStore'
import { getGroundVehicleState } from './groundVehicleState'

type PullAwayVibration = {
  handle: number
  previousSpeed: number
}

const stepPullAwayVibration = (state: PullAwayVibration, speed: number): PullAwayVibration => {
  const isPullingAway = state.previousSpeed === 0 && speed !== 0 && !isVibrationPlaying(state.handle)
  return {
    handle: isPullingAway
      ? startVibration('worldmap', CAR_PULL_AWAY_VIBRATION_PATTERN, CAR_PULL_AWAY_VIBRATION_PRIORITY)
      : state.handle,
    previousSpeed: speed,
  }
}

const usePullAwayVibration = () => {
  const stateRef = useRef<PullAwayVibration>({ handle: VIBRATION_NOT_STARTED, previousSpeed: 0 })

  useScriptTick(() => {
    if (isCarClass(useWorldmapStore.getState().vehicleId)) {
      stateRef.current = stepPullAwayVibration(stateRef.current, getGroundVehicleState().velocity)
    }
  })
}

export default usePullAwayVibration
