import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide, Mesh, Object3D } from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'

const CHARAONE_DIR = '/worldmap/wmset/charaone'

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
  const filename = `world_${sectionIndex.toString().padStart(3, '0')}.gltf`
  const { scene } = useGLTF(`${CHARAONE_DIR}/${filename}`)
  const cloned = useMemo(() => {
    const next = cloneSkinnedScene(scene)
    forceDoubleSide(next)
    return next
  }, [scene])
  return <primitive object={cloned} />
}

export default CharaModel
