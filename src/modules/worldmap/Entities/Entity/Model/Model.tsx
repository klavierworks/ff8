import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { DoubleSide, Material, Mesh, MeshBasicMaterial, Object3D, Texture, TextureLoader } from 'three'
import { OBJLoader } from 'three/examples/jsm/Addons.js'

import { loadAssetUrl } from '../../../../../loadAssetUrl'

type ModelProps = {
  index: number
}

const MODELS_DIR = '@data/worldmap/models'
const OBJ_LOADERS = import.meta.glob<string>('@data/worldmap/models/*.obj', {
  import: 'default',
  query: '?url',
})
const TEXTURE_LOADERS = import.meta.glob<string>('@data/worldmap/models/*.png', {
  import: 'default',
  query: '?url',
})

const createBasicMaterial = (source: Material, texture: Texture) => {
  const basic = new MeshBasicMaterial({ map: texture, side: DoubleSide })
  const color = (source as MeshBasicMaterial).color
  if (color) {
    basic.color = color
    basic.userData.originalColor = color.clone()
  }
  return basic
}

const cloneWithBasicMaterials = (source: Object3D, texture: Texture) => {
  const clone = source.clone(true)
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return
    }
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => createBasicMaterial(material, texture))
      : createBasicMaterial(child.material, texture)
  })
  return clone
}

const Model = ({ index }: ModelProps) => {
  const loadedObject = useLoader(OBJLoader, loadAssetUrl(OBJ_LOADERS, `${MODELS_DIR}/model_${index}.obj`))
  const texture = useLoader(TextureLoader, loadAssetUrl(TEXTURE_LOADERS, `${MODELS_DIR}/model_${index}.png`))
  const clone = useMemo(() => cloneWithBasicMaterials(loadedObject, texture), [loadedObject, texture])
  return <primitive object={clone} />
}

export default Model
