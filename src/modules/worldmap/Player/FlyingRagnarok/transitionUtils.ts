import { MathUtils } from 'three'

import { signExtend16 } from '../../../../utils'
import { WORLD_MAP_STATE_RAGNAROK_LANDING, WORLD_MAP_STATE_RAGNAROK_TAKEOFF } from '../../worldmapStore'
import {
  RAGNAROK_CEILING_ALTITUDE,
  RAGNAROK_FOLD_FRAME_STEP,
  RAGNAROK_FOLDED_FRAME,
  RAGNAROK_TAKEOFF_FOLD_TICKS,
  RAGNAROK_TRANSITION_DIVISOR,
  RAGNAROK_TRANSITION_LAST_TICK,
} from '../constants'

export type ShipTransition = {
  altitudeStep: number
  counter: number
  kind: number
}

const calculateAltitudeStep = (target: number, altitude: number) =>
  signExtend16(Math.trunc((target - altitude) / RAGNAROK_TRANSITION_DIVISOR))

const calculateTakeoffAltitude = (ground: number) => ground + ((RAGNAROK_CEILING_ALTITUDE - ground) >> 1)

export const createTakeoff = (altitude: number, ground: number): ShipTransition => ({
  altitudeStep: calculateAltitudeStep(calculateTakeoffAltitude(ground), altitude),
  counter: 0,
  kind: WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
})

export const createLanding = (altitude: number, ground: number): ShipTransition => ({
  altitudeStep: calculateAltitudeStep(ground, altitude),
  counter: 0,
  kind: WORLD_MAP_STATE_RAGNAROK_LANDING,
})

const clampFrame = (frame: number) => MathUtils.clamp(frame, 0, RAGNAROK_FOLDED_FRAME)

export const stepTakeoffFrame = (frame: number, counter: number) =>
  counter > RAGNAROK_TAKEOFF_FOLD_TICKS ? 0 : clampFrame(frame - RAGNAROK_FOLD_FRAME_STEP)

export const stepLandingFrame = (frame: number) => clampFrame(frame + RAGNAROK_FOLD_FRAME_STEP)

export const isTransitionFinished = ({ counter }: ShipTransition) => counter >= RAGNAROK_TRANSITION_LAST_TICK

export const advanceTransition = (transition: ShipTransition): ShipTransition => ({
  ...transition,
  counter: transition.counter + 1,
})
