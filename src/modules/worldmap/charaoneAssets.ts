import { useGLTF } from '@react-three/drei'

import { getAssetUrl } from '../../assetManifest'

export const getCharaoneUrl = (sectionIndex: number) =>
  getAssetUrl(`worldmap/charaone/world_${sectionIndex.toString().padStart(3, '0')}.glb`)

export const preloadCharaone = (sectionIndex: number) => {
  useGLTF.preload(getCharaoneUrl(sectionIndex))
}
