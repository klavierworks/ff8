import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject } from 'react'

import useGlobalStore from '../../../../store'
import { TARGET_FPS } from '../../../../timing'
import useWorldmapStore, {
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_TRANSITION_FRAMES,
} from '../../worldmapStore'
import { findGroundY, PLAYER_Y_OFFSET } from '../playerUtils'
import { VEHICLE_ON_FOOT } from './flightConstants'
import { FlightAttitude } from './useFlight'

type UseTransitionArgs = {
  attitudeRef: MutableRefObject<FlightAttitude>
}

const useTransition = ({ attitudeRef }: UseTransitionArgs) => {
  // Take-off lifts the ship to a fixed altitude above the ground it boarded
  // from; the pilot climbs further from there (see ida.md).
  const TAKEOFF_TARGET_ALTITUDE = 800 / 1000

  const scene = useThree((state) => state.scene)

  useFrame((_, delta) => {
    const worldmap = useWorldmapStore.getState()
    const transitionState = worldmap.worldMapState
    if (transitionState === WORLD_MAP_STATE_FREE_ROAM) {
      return
    }

    const position = useGlobalStore.getState().characterPosition
    if (!position) {
      return
    }

    const previousProgress = worldmap.worldMapStateProgress
    const remainingFrames = Math.max(1, WORLD_MAP_TRANSITION_FRAMES - previousProgress)
    const framesAdvanced = delta * TARGET_FPS

    // Landing: also interpolate the XZ position toward `landingTarget` so the
    // ship glides into the parking spot, snapping to it exactly at transition
    // end. Take-off does not move XZ — the ship lifts straight up from where
    // the pilot boarded.
    const target = worldmap.landingTarget
    const isLanding = transitionState === WORLD_MAP_STATE_RAGNAROK_LANDING
    const groundY = findGroundY(scene, position.x, position.z) ?? 0
    const targetAltitude = isLanding
      ? (target ? target.worldY : groundY) + PLAYER_Y_OFFSET
      : groundY + TAKEOFF_TARGET_ALTITUDE

    // The engine caches a fixed per-frame step (remaining distance / 60) at
    // transition start. We recompute the step dynamically against the remaining
    // frames so the integral still lands on `target` at progress == 60
    // regardless of frame rate.
    const altitudeStep = ((targetAltitude - position.y) / remainingFrames) * framesAdvanced
    const nextY = position.y + altitudeStep

    let nextX = position.x
    let nextZ = position.z
    if (isLanding && target) {
      nextX = position.x + ((target.worldX - position.x) / remainingFrames) * framesAdvanced
      nextZ = position.z + ((target.worldZ - position.z) / remainingFrames) * framesAdvanced
    }

    const nextProgress = Math.min(WORLD_MAP_TRANSITION_FRAMES, previousProgress + framesAdvanced)

    position.set(nextX, nextY, nextZ)

    // Bleed off speed and bank linearly across the 60-frame window so we end
    // straight-and-level (the engine zeros forward velocity on the first
    // transition frame).
    const t = Math.min(1, nextProgress / WORLD_MAP_TRANSITION_FRAMES)
    attitudeRef.current = {
      bankRadians: attitudeRef.current.bankRadians * (1 - t),
      speed: attitudeRef.current.speed * (1 - t),
    }

    if (nextProgress >= WORLD_MAP_TRANSITION_FRAMES) {
      if (isLanding) {
        // Snap to landing target exactly + drop to ground offset; switch back
        // to the saved pre-Ragnarok vehicle and remember the parked spot so
        // `FlyingRagnarok` can render the ship inline while the player is on
        // foot.
        position.set(
          target ? target.worldX : nextX,
          (target ? target.worldY : groundY) + PLAYER_Y_OFFSET,
          target ? target.worldZ : nextZ,
        )
        useWorldmapStore.setState({
          landingTarget: null,
          parkedRagnarokPosition: target,
          parkedRagnarokYawPsx: useGlobalStore.getState().fieldDirection,
          vehicleId: worldmap.preTransitionVehicleId ?? VEHICLE_ON_FOOT,
          worldMapState: WORLD_MAP_STATE_FREE_ROAM,
          worldMapStateProgress: 0,
        })
      } else {
        useWorldmapStore.setState({
          worldMapState: WORLD_MAP_STATE_FREE_ROAM,
          worldMapStateProgress: 0,
        })
      }
      return
    }

    useWorldmapStore.setState({ worldMapStateProgress: nextProgress })
  })
}

export default useTransition
