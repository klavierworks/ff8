import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { NearestFilter, Texture, TextureLoader } from 'three'

const MC_SHEET_URLS = import.meta.glob<string>('/extractor/data/converted/menu/cards/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

const ICON_SHEET_URLS = import.meta.glob<string>('/extractor/data/converted/exe/cardgame_icons/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

const ICONS_PALETTE = '09'

const orderedMcUrls = (() => {
  const byIndex: string[] = []
  for (const [path, url] of Object.entries(MC_SHEET_URLS)) {
    const match = path.match(/mc(\d{2})/)
    if (match) {
      byIndex[Number(match[1])] = url
    }
  }
  return byIndex
})()

const iconsUrl = Object.entries(ICON_SHEET_URLS).find(([path]) => path.endsWith(`${ICONS_PALETTE}.png`))?.[1]

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
  const urls = useMemo(() => [...orderedMcUrls, iconsUrl].filter((url): url is string => Boolean(url)), [])
  const textures = useLoader(TextureLoader, urls)

  return useMemo(() => {
    const mcSheets = textures.slice(0, orderedMcUrls.length).map(configurePixelArt)
    const iconsSheet = configurePixelArt(textures[orderedMcUrls.length])
    return { iconsSheet, mcSheets }
  }, [textures])
}

export default useTextures
