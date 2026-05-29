import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Group, Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { PSX_ANGLE_TO_RAD, WORLDMAP_SCALE } from '../constants'
import CharaModel from '../Entities/Entity/CharaModel/CharaModel'
import { FieldLandingPosition } from '../useSections'
import useWorldmapStore from '../worldmapStore'
import { VEHICLE_RAGNAROK } from './FlyingRagnarok/flightConstants'
import FlyingRagnarok from './FlyingRagnarok/FlyingRagnarok'
import { psxXToWorld, psxZToWorld } from './playerUtils'
import useCharacterAnimation from './useCharacterAnimation'
import useMovement from './useMovement'

const ON_FOOT_CHARAONE_SECTION = 0
const CHARAONE_PATH = `/worldmap/wmset/charaone/world_${ON_FOOT_CHARAONE_SECTION.toString().padStart(3, '0')}.gltf`

const MODEL_PITCH_X = -Math.PI / 2

const PLAYER_SCALE = WORLDMAP_SCALE * 100 * 1.5

const isPopulated = (entry: FieldLandingPosition) => entry.x !== 0 || entry.y !== 0 || entry.z !== 0

const toSpawnXZ = (entry: FieldLandingPosition) => new Vector3(psxXToWorld(entry.x), 0, psxZToWorld(entry.y))

const useSpawnPoint = (landings: readonly FieldLandingPosition[]): undefined | Vector3 => {
  const spawnPointId = useWorldmapStore((state) => state.spawnPointId)
  return useMemo(() => {
    const entry = landings[spawnPointId]
    if (entry && isPopulated(entry)) {
      return toSpawnXZ(entry)
    }
    const populated = landings.filter(isPopulated)
    if (populated.length === 0) {
      return undefined
    }
    return toSpawnXZ(populated[Math.floor(Math.random() * populated.length)])
  }, [landings, spawnPointId])
}

const useSpawnYaw = (landings: readonly FieldLandingPosition[]): number | undefined => {
  const spawnPointId = useWorldmapStore((state) => state.spawnPointId)
  return useMemo(() => {
    const entry = landings[spawnPointId]
    if (entry && isPopulated(entry)) {
      return entry.player_yaw * 16
    }
    return undefined
  }, [landings, spawnPointId])
}

const ignoreRaycast = () => undefined
const disableRaycastForSubtree = (root: Group) => {
  root.traverse((child) => {
    child.raycast = ignoreRaycast
  })
}

type PlayerProps = {
  landings: readonly FieldLandingPosition[]
}

const OnFootPlayer = ({ landings }: PlayerProps) => {
  const spawnPosition = useSpawnPoint(landings)
  const spawnYaw = useSpawnYaw(landings)
  const groupRef = useRef<Group>(null)
  const animGroupRef = useRef<Group>(null)
  const characterPosition = useGlobalStore((state) => state.characterPosition)

  const speedRef = useRef(0)
  useMovement(speedRef)

  const { animations } = useGLTF(CHARAONE_PATH)
  useCharacterAnimation(animations, animGroupRef, speedRef)

  const [meshYOffset, setMeshYOffset] = useState(0)

  const setOuterGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group
    if (group) {
      disableRaycastForSubtree(group)
    }
  }, [])

  const setMeshGroupRef = useCallback((group: Group | null) => {
    animGroupRef.current = group
    if (!group) {
      return
    }
    group.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(group)
    if (bounds.isEmpty()) {
      return
    }
    const worldPosition = new Vector3()
    group.getWorldPosition(worldPosition)
    setMeshYOffset(worldPosition.y - bounds.min.y)
  }, [])

  useEffect(() => {
    if (!spawnPosition) {
      return
    }
    // Seed `characterPosition` only on cold start — if it's already set (e.g.
    // we just dismounted the Ragnarok after a landing transition), preserve
    // the landed position instead of teleporting back to the field-landing
    // spawn point. Yaw is set unconditionally because the landing sequence
    // doesn't reorient the player.
    if (!useGlobalStore.getState().characterPosition) {
      useGlobalStore.setState({
        characterPosition: spawnPosition.clone(),
        ...(spawnYaw !== undefined ? { fieldDirection: spawnYaw } : {}),
      })
    }
  }, [spawnPosition, spawnYaw])

  useFrame(() => {
    const group = groupRef.current
    if (!group) {
      return
    }
    const state = useGlobalStore.getState()
    if (!state.characterPosition) {
      return
    }
    group.position.copy(state.characterPosition)
    group.rotation.y = state.fieldDirection * PSX_ANGLE_TO_RAD
  })

  if (!characterPosition) {
    return null
  }

  return (
    <group ref={setOuterGroupRef}>
      <Suspense fallback={null}>
        <group
          position={[0, meshYOffset, 0]}
          ref={setMeshGroupRef}
          rotation={[MODEL_PITCH_X, 0, 0]}
          scale={PLAYER_SCALE}
        >
          <CharaModel sectionIndex={ON_FOOT_CHARAONE_SECTION} />
        </group>
      </Suspense>
    </group>
  )
}

// `FlyingRagnarok` is always mounted so its Ship subtree (moved out of the
// cached useGLTF scene on first mount) survives the on-foot ↔ aboard cycle.
// `OnFootPlayer` only renders when not currently piloting the Ragnarok.
const Player = ({ landings }: PlayerProps) => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const isAboardRagnarok = vehicleId === VEHICLE_RAGNAROK
  return (
    <>
      {!isAboardRagnarok && <OnFootPlayer landings={landings} />}
      <FlyingRagnarok />
    </>
  )
}

export default Player
