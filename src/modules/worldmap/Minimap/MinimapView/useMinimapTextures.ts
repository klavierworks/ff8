import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { NearestFilter, NoColorSpace, Texture, TextureLoader } from 'three'

const WORLD_TEXTURE_URLS = import.meta.glob<string>(
  [
    '@data/worldmap/textures/world/world_11.png',
    '@data/worldmap/textures/world/world_11_1.png',
    '@data/worldmap/textures/world/world_24.png',
    '@data/worldmap/textures/world/world_25.png',
  ],
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
)

const getWorldTextureUrl = (name: string) => {
  const entry = Object.entries(WORLD_TEXTURE_URLS).find(([path]) => path.endsWith(`/${name}.png`))
  if (!entry) {
    throw new Error(`Missing worldmap texture ${name}`)
  }
  return entry[1]
}

const TEXTURE_URLS = [
  getWorldTextureUrl('world_11'),
  getWorldTextureUrl('world_11_1'),
  getWorldTextureUrl('world_25'),
  getWorldTextureUrl('world_24'),
  'cursor.png',
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
