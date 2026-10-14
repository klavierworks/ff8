import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { TextureLoader } from 'three'
import { OBJLoader } from 'three/examples/jsm/Addons.js'

import { getAssetUrl } from '../../../../../assetManifest'
import useWorldmapStore from '../../../worldmapStore'
import { applyModelTint, cloneWithModelMaterial, prepareAtlasTexture } from './modelMaterialUtils'

type ModelProps = {
  index: number
}

const MODELS_DIR = 'worldmap/models'
const ATLAS_PATH = `${MODELS_DIR}/atlas.png`

const Model = ({ index }: ModelProps) => {
  const loadedObject = useLoader(OBJLoader, getAssetUrl(`${MODELS_DIR}/model_${index}.obj`))
  const texture = useLoader(TextureLoader, getAssetUrl(ATLAS_PATH))
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
