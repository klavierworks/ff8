import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'

import { getCharaoneUrl } from '../../../charaoneAssets'
import { cloneDoubleSidedScene } from './charaModelUtils'

type CharaModelProps = {
  sectionIndex: number
}

const CharaModel = ({ sectionIndex }: CharaModelProps) => {
  const { scene } = useGLTF(getCharaoneUrl(sectionIndex))
  const clone = useMemo(() => cloneDoubleSidedScene(scene), [scene])
  return <primitive object={clone} />
}

export default CharaModel
