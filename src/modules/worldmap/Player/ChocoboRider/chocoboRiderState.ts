import { ClipPose } from '../clipPlaybackUtils'
import { CLIP_RIDE_STAND } from '../constants'
import { ShipPose } from '../shipPose'
import { CompanionTrail } from './companionTrailUtils'
import { RunOffSearch, RunOffWaypoint } from './runOffPathUtils'
import { ChocoboPose } from './runOffUtils'

export type ChocoboDismount = {
  elapsedTicks: number
  spot: ShipPose
}

export type RunOff =
  | { path: readonly RunOffWaypoint[]; phase: 'waiting'; pose: ChocoboPose; trailMark: number }
  | {
      path: readonly RunOffWaypoint[]
      phase: 'running'
      pose: ChocoboPose
      trailMark: number | undefined
      waypointIndex: number
    }
  | { phase: 'finished'; pose: ChocoboPose }
  | { phase: 'idle' }
  | { phase: 'searching'; pose: ChocoboPose; search: RunOffSearch }
  | { phase: 'starting'; pose: ChocoboPose }

type ChocoboRiderState = {
  dismount: ChocoboDismount | null
  dismountFrame: number
  riderPose: ClipPose
  runOff: RunOff
  trail: CompanionTrail | null
}

const INITIAL_STATE: ChocoboRiderState = {
  dismount: null,
  dismountFrame: 0,
  riderPose: { clip: CLIP_RIDE_STAND, frame: 0 },
  runOff: { phase: 'idle' },
  trail: null,
}

let state = INITIAL_STATE

export const getChocoboRiderState = () => state

export const updateChocoboRiderState = (changes: Partial<ChocoboRiderState>) => {
  state = { ...state, ...changes }
}

export const resetChocoboRiderState = () => {
  state = INITIAL_STATE
}
