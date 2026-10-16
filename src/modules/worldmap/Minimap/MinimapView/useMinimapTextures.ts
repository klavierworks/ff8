import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { NearestFilter, NoColorSpace, Texture, TextureLoader } from 'three'

import { MINIMAP_TEXTURE_URLS } from './minimapTextureUrls'

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
  const sourceTextures = useLoader(TextureLoader, MINIMAP_TEXTURE_URLS)
  const rawTextures = useMemo(() => sourceTextures.map(createRawTexture), [sourceTextures])

  useEffect(() => () => rawTextures.forEach((texture) => texture.dispose()), [rawTextures])

  return useMemo(() => {
    const [colorMap, greyscaleMap, needle, cone, cursor] = rawTextures
    return { colorMap, cone, cursor, greyscaleMap, needle }
  }, [rawTextures])
}

export type MinimapTextures = ReturnType<typeof useMinimapTextures>

export default useMinimapTextures
