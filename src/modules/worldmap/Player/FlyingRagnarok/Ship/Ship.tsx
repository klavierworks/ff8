import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { getCharaoneUrl } from '../../../charaoneAssets'
import { CHARAONE_MODEL_SCALE } from '../../../constants'
import { buildRagnarokRoot, calculateShipClipTime, RAGNAROK_CHARAONE_SECTION, RAGNAROK_DEPLOY_CLIP } from './shipUtils'

const Ship = () => {
  const { animations, scene } = useGLTF(getCharaoneUrl(RAGNAROK_CHARAONE_SECTION))
  const root = useMemo(() => buildRagnarokRoot(scene), [scene])
  const groupRef = useRef<Group>(null)
  const { actions } = useAnimations(animations, groupRef)

  useEffect(() => {
    const action = actions[RAGNAROK_DEPLOY_CLIP]
    if (!action) {
      return
    }
    action.reset().play()
    action.paused = true
  }, [actions])

  useFrame(() => {
    const action = actions[RAGNAROK_DEPLOY_CLIP]
    if (!action) {
      return
    }
    action.time = calculateShipClipTime(action.getClip().duration)
  })

  return (
    <group ref={groupRef} scale={CHARAONE_MODEL_SCALE}>
      <primitive object={root} />
    </group>
  )
}

export default Ship
