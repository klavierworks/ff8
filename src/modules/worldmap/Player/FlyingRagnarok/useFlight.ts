import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject } from 'react'

import useGlobalStore from '../../../../store'
import { TARGET_FPS } from '../../../../timing'
import { WORLD_WRAP_X, WORLD_WRAP_Z, WORLDMAP_SCALE } from '../../constants'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { psxToRadians, radiansToPsx } from '../playerAngles'
import { findGroundY } from '../playerUtils'
import { VEHICLE_RAGNAROK } from './flightConstants'

const RAGNAROK_ALTITUDE_RATE_PER_AXIS = (120 / 256) * TARGET_FPS * WORLDMAP_SCALE
import {
  buildRagnarokInputAxes,
  horizontalVelocity,
  ragnarokVerticalVelocity,
  stepRagnarokBank,
  stepRagnarokCameraTilt,
  stepRagnarokSpeed,
  stepRagnarokYaw,
  wrapWorldAxis,
} from './flightUtils'

export type FlightAttitude = {
  bankRadians: number
  speed: number
}

const RAGNAROK_MIN_CLEARANCE = 60 * WORLDMAP_SCALE

const _velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

type UseFlightArgs = {
  attitudeRef: MutableRefObject<FlightAttitude>
}

const useFlight = ({ attitudeRef }: UseFlightArgs) => {
  const scene = useThree((state) => state.scene)

  useFrame((_, delta) => {
    const store = useGlobalStore.getState()
    const position = store.characterPosition
    if (!position) {
      return
    }

    const worldmap = useWorldmapStore.getState()
    if (worldmap.vehicleId !== VEHICLE_RAGNAROK) {
      return
    }
    if (worldmap.worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
      return
    }
    const controls = worldmap.controls
    const axes = buildRagnarokInputAxes(controls)
    const attitude = attitudeRef.current

    const nextSpeed = stepRagnarokSpeed(attitude.speed, axes.throttleAxis, delta)

    const currentYawRadians = psxToRadians(store.fieldDirection)
    const targetYawRadians = worldmap.camera.yawRadians
    const nextYawRadians = stepRagnarokYaw(currentYawRadians, axes.yawAxis, targetYawRadians, delta)

    const nextBankRadians = stepRagnarokBank(attitude.bankRadians, axes.yawAxis, delta)

    horizontalVelocity(nextYawRadians, nextSpeed, _velocity)
    _velocity.y = ragnarokVerticalVelocity(axes.altitudeAxis, RAGNAROK_ALTITUDE_RATE_PER_AXIS)

    const tentativeX = wrapWorldAxis(position.x + _velocity.x * delta, WORLD_WRAP_X)
    const tentativeZ = wrapWorldAxis(position.z + _velocity.z * delta, WORLD_WRAP_Z)
    const integratedY = position.y + _velocity.y * delta

    // Port-side floor: the original doesn't bound altitude — it's a free
    // vertical integration. We add a minimum-clearance floor so the ship
    // doesn't sink into the walkmesh near the ground. No ceiling — climb is
    // unbounded. Over open ocean/void `findGroundY` returns undefined; there is
    // no terrain to clamp against, so the integrated altitude is used as-is
    // (clamping to a phantom ground at y=0 would teleport the ship upward).
    const groundY = findGroundY(scene, tentativeX, tentativeZ)
    const floorY = groundY === undefined ? undefined : groundY + RAGNAROK_MIN_CLEARANCE
    const tentativeY = floorY !== undefined && integratedY < floorY ? floorY : integratedY

    position.set(tentativeX, tentativeY, tentativeZ)

    attitudeRef.current = {
      bankRadians: nextBankRadians,
      speed: nextSpeed,
    }

    const nextTiltPsx = stepRagnarokCameraTilt(worldmap.ragnarokCameraTiltPsx, axes.altitudeAxis, delta)

    useGlobalStore.setState({ fieldDirection: radiansToPsx(nextYawRadians) })
    useWorldmapStore.setState({ ragnarokCameraTiltPsx: nextTiltPsx })
  })
}

export default useFlight
