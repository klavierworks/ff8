import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { NearestFilter, Texture, TextureLoader } from 'three'

import { getAssetUrl, listAssets } from '../../assetManifest'

const ICONS_PALETTE = '09'

const orderedMcPaths = (() => {
  const byIndex: string[] = []
  for (const path of listAssets('menu/cards/')) {
    const match = path.match(/mc(\d{2})/)
    if (match) {
      byIndex[Number(match[1])] = path
    }
  }
  return byIndex
})()

const SHEET_URLS = [...orderedMcPaths, `exe/cardgame_icons/${ICONS_PALETTE}.png`]
  .filter((path): path is string => Boolean(path))
  .map(getAssetUrl)

const configurePixelArt = (texture: Texture) => {
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

export type CardGameTextures = {
  iconsSheet: Texture
  mcSheets: Texture[]
}

const useTextures = (): CardGameTextures => {
  const textures = useLoader(TextureLoader, SHEET_URLS)

  return useMemo(() => {
    const mcSheets = textures.slice(0, orderedMcPaths.length).map(configurePixelArt)
    const iconsSheet = configurePixelArt(textures[orderedMcPaths.length])
    return { iconsSheet, mcSheets }
  }, [textures])
}

export default useTextures
