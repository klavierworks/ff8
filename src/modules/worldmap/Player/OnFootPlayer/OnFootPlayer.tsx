import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { Group } from 'three'

import { loadAssetUrl } from '../../../../loadAssetUrl'
import useGlobalStore from '../../../../store'
import { buildCharaoneKey, CHARAONE_LOADERS } from '../../charaoneAssets'
import { CHARAONE_MODEL_PITCH_X, CHARAONE_MODEL_SCALE } from '../../constants'
import CharaModel from '../../Entities/Entity/CharaModel/CharaModel'
import { FieldLandingPosition } from '../../useSections'
import useWorldmapStore from '../../worldmapStore'
import { ON_FOOT_CHARAONE_SECTION, ON_FOOT_TAG } from '../constants'
import { psxToRadians } from '../playerAngles'
import { createSpawnPosition, getSpawnFieldDirection, isOnCanopyGround } from '../playerUtils'
import useCharacterAnimation from '../useCharacterAnimation'
import useMovement from '../useMovement'

const ON_FOOT_CHARAONE_KEY = buildCharaoneKey(ON_FOOT_CHARAONE_SECTION)

const ignoreRaycast = () => undefined

const disableRaycastForSubtree = (root: Group) => {
  root.traverse((child) => {
    child.raycast = ignoreRaycast
  })
}

const placeAtLandingIfUnplaced = (landing: FieldLandingPosition) => {
  if (useGlobalStore.getState().characterPosition) {
    return
  }
  useGlobalStore.setState({
    characterPosition: createSpawnPosition(landing),
    fieldDirection: getSpawnFieldDirection(landing),
  })
}

type OnFootPlayerProps = {
  landings: readonly FieldLandingPosition[]
}

const OnFootPlayer = ({ landings }: OnFootPlayerProps) => {
  const spawnPointId = useWorldmapStore((state) => state.spawnPointId)
  const characterPosition = useGlobalStore((state) => state.characterPosition)
  const landing = landings[spawnPointId]
  const groupRef = useRef<Group>(null)
  const meshGroupRef = useRef<Group>(null)

  useMovement()

  const { animations } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, ON_FOOT_CHARAONE_KEY))
  useCharacterAnimation(animations, meshGroupRef, ON_FOOT_TAG, isOnCanopyGround)

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group
    if (group) {
      disableRaycastForSubtree(group)
    }
  }, [])

  useEffect(() => {
    if (landing) {
      placeAtLandingIfUnplaced(landing)
    }
  }, [landing])

  useFrame(() => {
    const group = groupRef.current
    const { characterPosition: position, fieldDirection } = useGlobalStore.getState()
    if (!group || !position) {
      return
    }
    group.position.copy(position)
    group.rotation.y = psxToRadians(fieldDirection)
    group.visible = !isOnCanopyGround()
  })

  if (!characterPosition) {
    return null
  }

  return (
    <group ref={setGroupRef}>
      <Suspense fallback={null}>
        <group ref={meshGroupRef} rotation={[CHARAONE_MODEL_PITCH_X, 0, 0]} scale={CHARAONE_MODEL_SCALE}>
          <CharaModel sectionIndex={ON_FOOT_CHARAONE_SECTION} />
        </group>
      </Suspense>
    </group>
  )
}

export default OnFootPlayer
