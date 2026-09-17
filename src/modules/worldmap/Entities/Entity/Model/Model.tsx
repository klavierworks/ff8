import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { TextureLoader } from 'three'
import { OBJLoader } from 'three/examples/jsm/Addons.js'

import { loadAssetUrl } from '../../../../../loadAssetUrl'
import useWorldmapStore from '../../../worldmapStore'
import { applyModelTint, cloneWithModelMaterial, prepareAtlasTexture } from './modelMaterialUtils'

type ModelProps = {
  index: number
}

const MODELS_DIR = '/extractor/data/converted/worldmap/models'
const ATLAS_KEY = `${MODELS_DIR}/atlas.png`
const OBJ_LOADERS = import.meta.glob<string>('@data/worldmap/models/*.obj', {
  import: 'default',
  query: '?url',
})
const ATLAS_LOADERS = import.meta.glob<string>('@data/worldmap/models/atlas.png', {
  import: 'default',
  query: '?url',
})

const Model = ({ index }: ModelProps) => {
  const loadedObject = useLoader(OBJLoader, loadAssetUrl(OBJ_LOADERS, `${MODELS_DIR}/model_${index}.obj`))
  const texture = useLoader(TextureLoader, loadAssetUrl(ATLAS_LOADERS, ATLAS_KEY))
  const tint = useWorldmapStore((state) => state.skyLightColor2)
  const { clone, material } = useMemo(() => {
    prepareAtlasTexture(texture)
    return cloneWithModelMaterial(loadedObject, texture)
  }, [loadedObject, texture])

  useEffect(() => {
    applyModelTint(material, tint)
  }, [material, tint])

  useEffect(() => () => material.dispose(), [material])

  return <primitive object={clone} />
}

export default Model
