import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { DoubleSide, Material, Mesh, MeshBasicMaterial, Texture, TextureLoader } from 'three'
import { OBJLoader } from 'three/examples/jsm/Addons.js'

const MODELS_DIR = '/worldmap/wmset/models'

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
  const obj = useLoader(OBJLoader, `${MODELS_DIR}/model_${index}.obj`)
  const texture = useLoader(TextureLoader, `${MODELS_DIR}/model_${index}.png`)
  const cloned = useMemo(() => {
    const group = obj.clone(true)
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
  }, [obj, texture])
  return <primitive object={cloned} />
}

export default Model
