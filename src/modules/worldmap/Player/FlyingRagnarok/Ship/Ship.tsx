import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { loadAssetUrl, preloadAssetUrl } from '../../../../../loadAssetUrl'
import { CHARAONE_LOADERS } from '../../../charaoneAssets'
import { CHARAONE_MODEL_SCALE } from '../../../constants'
import { buildRagnarokRoot, calculateShipClipTime, RAGNAROK_DEPLOY_CLIP, RAGNAROK_GLB_KEY } from './shipUtils'

const Ship = () => {
  const { animations, scene } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, RAGNAROK_GLB_KEY))
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

preloadAssetUrl(CHARAONE_LOADERS, RAGNAROK_GLB_KEY, useGLTF.preload)

export default Ship
