import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'

import { loadAssetUrl } from '../../../../../loadAssetUrl'
import { buildCharaoneKey, CHARAONE_LOADERS } from '../../../charaoneAssets'
import { cloneDoubleSidedScene } from './charaModelUtils'

type CharaModelProps = {
  sectionIndex: number
}

const CharaModel = ({ sectionIndex }: CharaModelProps) => {
  const { scene } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, buildCharaoneKey(sectionIndex)))
  const clone = useMemo(() => cloneDoubleSidedScene(scene), [scene])
  return <primitive object={clone} />
}

export default CharaModel
