import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { NearestFilter, NoColorSpace, Texture, TextureLoader } from 'three'

import { getAssetUrl } from '../../../../assetManifest'
import cursorUrl from '../../../../assets/cursor.png?url'

const WORLD_TEXTURE_NAMES = ['world_11', 'world_11_1', 'world_25', 'world_24']

const TEXTURE_URLS = [
  ...WORLD_TEXTURE_NAMES.map((name) => getAssetUrl(`worldmap/textures/world/${name}.png`)),
  cursorUrl,
]

const createRawTexture = (source: Texture) => {
  const texture = source.clone()
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const useMinimapTextures = () => {
  const sourceTextures = useLoader(TextureLoader, TEXTURE_URLS)
  const rawTextures = useMemo(() => sourceTextures.map(createRawTexture), [sourceTextures])

  useEffect(() => () => rawTextures.forEach((texture) => texture.dispose()), [rawTextures])

  return useMemo(() => {
    const [colorMap, greyscaleMap, needle, cone, cursor] = rawTextures
    return { colorMap, cone, cursor, greyscaleMap, needle }
  }, [rawTextures])
}

export type MinimapTextures = ReturnType<typeof useMinimapTextures>

export default useMinimapTextures
