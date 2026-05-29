import { useThree } from '@react-three/fiber'
import { useCallback, useMemo } from 'react'

import { WORLDMAP_CONTROLS_MAP } from '../../../constants/controls'
import useGlobalStore from '../../../store'
import { WORLDMAP_CAMERA_MODES } from '../Camera/cameraUtils'
import { MINIMAP_MODES } from '../Minimap/minimapUtils'
import { VEHICLE_RAGNAROK } from '../Player/FlyingRagnarok/flightConstants'
import { findNearestLandingSpot } from '../Player/FlyingRagnarok/landingSpots'
import { findGroundY, PLAYER_Y_OFFSET } from '../Player/playerUtils'
import useWorldmapStore, {
  RagnarokLandingSpot,
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../worldmapStore'
import { areControlsEqual, deriveControlsState } from './controlsUtils'
import useHeldKeys from './useHeldKeys'

const Controls = () => {
  const watchedCodes = useMemo(() => Object.values(WORLDMAP_CONTROLS_MAP), [])
  const scene = useThree((state) => state.scene)

  const handleChange = useCallback(
    (heldKeys: Set<string>, downCode: null | string) => {
      if (downCode !== null) {
        switch (downCode) {
          case WORLDMAP_CONTROLS_MAP.toggleCameraMode:
            useWorldmapStore.setState((state) => ({
              cameraModeIndex: (state.cameraModeIndex + 1) % WORLDMAP_CAMERA_MODES.length,
            }))
            break
          case WORLDMAP_CONTROLS_MAP.toggleMinimap:
            useWorldmapStore.setState((state) => ({
              minimapMode: (state.minimapMode + 1) % MINIMAP_MODES.length,
            }))
            break
          case WORLDMAP_CONTROLS_MAP.toggleRagnarok: {
            const state = useWorldmapStore.getState()
            if (state.worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
              break
            }
            if (state.vehicleId === VEHICLE_RAGNAROK) {
              const position = useGlobalStore.getState().characterPosition
              if (!position) {
                break
              }
              const groundY = findGroundY(scene, position.x, position.z)
              if (groundY === undefined) {
                break
              }
              const namedSpot = findNearestLandingSpot(state.landingSpots, position.x, position.z)
              const target: RagnarokLandingSpot = namedSpot ?? {
                worldX: position.x,
                worldY: groundY + PLAYER_Y_OFFSET,
                worldZ: position.z,
              }
              // Don't overwrite `preTransitionVehicleId` here — it was set at take-off
              // to the on-foot vehicle that the pilot boarded from, and the landing
              // transition reads it to restore that vehicle on touchdown.
              useWorldmapStore.setState({
                landingTarget: target,
                worldMapState: WORLD_MAP_STATE_RAGNAROK_LANDING,
                worldMapStateProgress: 0,
              })
            } else {
              useWorldmapStore.setState({
                parkedRagnarokPosition: null,
                parkedRagnarokYawPsx: null,
                preTransitionVehicleId: state.vehicleId,
                vehicleId: VEHICLE_RAGNAROK,
                worldMapState: WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
                worldMapStateProgress: 0,
              })
            }
            break
          }
          default:
            break
        }
      }
      const next = deriveControlsState(heldKeys)
      useWorldmapStore.setState((state) => {
        if (areControlsEqual(state.controls, next)) {
          return state
        }
        return { controls: next }
      })
    },
    [scene],
  )

  useHeldKeys({ onChange: handleChange, watchedCodes })

  return null
}

export default Controls
