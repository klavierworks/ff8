import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useRef } from 'react'
import { Group } from 'three'

import useGlobalStore from '../../../../store'
import { PSX_ANGLE_TO_RAD } from '../../constants'
import useWorldmapStore from '../../worldmapStore'
import { VEHICLE_RAGNAROK } from './flightConstants'
import Ship from './Ship/Ship'
import useEngineSound from './useEngineSound'
import useFlight, { FlightAttitude } from './useFlight'
import useTransition from './useTransition'

const RAGNAROK_VISUAL_SCALE = 1.5

const INITIAL_ATTITUDE: FlightAttitude = {
  bankRadians: 0,
  speed: 0,
}

// Single Ragnarok instance that stays mounted across the on-foot ↔ aboard
// cycle. The flight/transition/engine hooks self-gate on `worldMapState` and
// `vehicleId`, so it's safe to run them unconditionally — keeping them mounted
// preserves the AnimationMixer's bindings against the cached GLTF subtree that
// `Ship` moves into its root on first mount.
//
// Position source switches between `characterPosition` (while aboard, driven by
// `useFlight`/`useTransition`) and `parkedRagnarokPosition` (while the pilot is
// on-foot, set by the landing animator). The Ship is hidden entirely when
// neither applies — i.e. on cold start before any take-off.
const FlyingRagnarok = () => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const hasPosition = useGlobalStore((state) => !!state.characterPosition)
  const parkedPosition = useWorldmapStore((state) => state.parkedRagnarokPosition)

  const outerGroupRef = useRef<Group>(null)
  const shipGroupRef = useRef<Group>(null)
  const attitudeRef = useRef<FlightAttitude>({ ...INITIAL_ATTITUDE })

  useTransition({ attitudeRef })
  useFlight({ attitudeRef })
  useEngineSound({ attitudeRef })

  const setOuterGroupRef = useCallback((group: Group | null) => {
    outerGroupRef.current = group
  }, [])

  const setShipGroupRef = useCallback((group: Group | null) => {
    shipGroupRef.current = group
  }, [])

  useFrame(() => {
    const outerGroup = outerGroupRef.current
    const shipGroup = shipGroupRef.current
    if (!outerGroup || !shipGroup) {
      return
    }

    const worldmap = useWorldmapStore.getState()
    const isAboardNow = worldmap.vehicleId === VEHICLE_RAGNAROK

    if (isAboardNow) {
      const pos = useGlobalStore.getState().characterPosition
      if (!pos) {
        return
      }
      outerGroup.position.copy(pos)
      outerGroup.rotation.y = useGlobalStore.getState().fieldDirection * PSX_ANGLE_TO_RAD
    } else {
      const parked = worldmap.parkedRagnarokPosition
      if (!parked) {
        return
      }
      outerGroup.position.set(parked.worldX, parked.worldY, parked.worldZ)
      outerGroup.rotation.y = (worldmap.parkedRagnarokYawPsx ?? 0) * PSX_ANGLE_TO_RAD
    }

    shipGroup.rotation.z = isAboardNow ? attitudeRef.current.bankRadians : 0
  })

  const isAboard = vehicleId === VEHICLE_RAGNAROK
  const isVisible = isAboard ? hasPosition : !!parkedPosition

  if (!isVisible) {
    return null
  }

  return (
    <group ref={setOuterGroupRef}>
      <group ref={setShipGroupRef}>
        <group rotation={[-Math.PI / 2, 0, 0]} scale={RAGNAROK_VISUAL_SCALE}>
          <Suspense fallback={null}>
            <Ship />
          </Suspense>
        </group>
      </group>
    </group>
  )
}

export default FlyingRagnarok
