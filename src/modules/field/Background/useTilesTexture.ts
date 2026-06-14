import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { ClampToEdgeWrapping, NearestFilter, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'

import { loadAssetUrl } from '../../../loadAssetUrl'

// Field sprites live alongside their field data as `<field>/<field>.png`. The glob stays lazy
// (one thunk per file, resolved on demand) so loading a field doesn't pull in every sprite;
// map basename -> glob key so the caller can keep passing the sprite filename.
const SPRITE_LOADERS = import.meta.glob<string>('/extractor/data/converted/field/mapdata/*/*.png', {
  import: 'default',
  query: '?url',
})
const SPRITE_KEY_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.keys(SPRITE_LOADERS).map((path) => [path.split('/').pop() as string, path]),
)

const useTilesTexture = (filename: string) => {
  const tilesTexture = useLoader(TextureLoader, loadAssetUrl(SPRITE_LOADERS, SPRITE_KEY_BY_NAME[filename]))

  return useMemo(() => {
    tilesTexture.format = RGBAFormat
    tilesTexture.generateMipmaps = false
    tilesTexture.wrapS = ClampToEdgeWrapping
    tilesTexture.wrapT = ClampToEdgeWrapping
    tilesTexture.magFilter = NearestFilter
    tilesTexture.minFilter = NearestFilter
    tilesTexture.colorSpace = SRGBColorSpace

    return tilesTexture
  }, [tilesTexture])
}

export default useTilesTexture
