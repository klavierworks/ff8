import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { DoubleSide, Material, Mesh, MeshBasicMaterial, Texture, TextureLoader } from 'three'
import { OBJLoader } from 'three/examples/jsm/Addons.js'

import { loadAssetUrl } from '../../../../../loadAssetUrl'

const MODELS_DIR = '/extractor/data/converted/worldmap/models'
const OBJ_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/models/*.obj', {
  import: 'default',
  query: '?url',
})
const TEXTURE_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/models/*.png', {
  import: 'default',
  query: '?url',
})

const createBasicMaterial = (source: Material, texture: Texture): MeshBasicMaterial => {
  const basic = new MeshBasicMaterial()
  const color = (source as MeshBasicMaterial).color
  if (color) {
    basic.color = color
    basic.userData.originalColor = color.clone()
  }
  basic.map = texture
  basic.side = DoubleSide
  return basic
}

type ModelProps = {
  index: number
}

const Model = ({ index }: ModelProps) => {
  const loadedObject = useLoader(OBJLoader, loadAssetUrl(OBJ_LOADERS, `${MODELS_DIR}/model_${index}.obj`))
  const texture = useLoader(TextureLoader, loadAssetUrl(TEXTURE_LOADERS, `${MODELS_DIR}/model_${index}.png`))
  const cloned = useMemo(() => {
    const group = loadedObject.clone(true)
    group.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return
      }
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => createBasicMaterial(material, texture))
        return
      }
      child.material = createBasicMaterial(child.material, texture)
    })
    return group
  }, [loadedObject, texture])
  return <primitive object={cloned} />
}

export default Model
