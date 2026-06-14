import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide, Mesh, Object3D } from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { loadAssetUrl } from '../../../../../loadAssetUrl'

const CHARAONE_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/charaone/*.glb', {
  import: 'default',
  query: '?url',
})

const charaoneKey = (sectionIndex: number) =>
  `/extractor/data/converted/worldmap/charaone/world_${sectionIndex.toString().padStart(3, '0')}.glb`

const forceDoubleSide = (root: Object3D) => {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return
    }

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material.side = DoubleSide
      })
      return
    }
    child.material.side = DoubleSide
  })
}

type CharaModelProps = {
  sectionIndex: number
}

const CharaModel = ({ sectionIndex }: CharaModelProps) => {
  const { scene } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, charaoneKey(sectionIndex)))
  const cloned = useMemo(() => {
    const next = cloneSkinnedScene(scene)
    forceDoubleSide(next)
    return next
  }, [scene])
  return <primitive object={cloned} />
}

export default CharaModel
