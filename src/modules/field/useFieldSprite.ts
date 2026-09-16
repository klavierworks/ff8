import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { ClampToEdgeWrapping, NearestFilter, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'

import { loadAssetUrl } from '../../loadAssetUrl'

// Field sprite sheets live alongside their field data as `<field>/<field>*.png`. The glob
// stays lazy (one thunk per file, resolved on demand) so loading a field doesn't pull in
// every sprite; map basename -> glob key so the caller can keep passing the filename.
const SPRITE_LOADERS = import.meta.glob<string>('@data/field/mapdata/*/*.png', {
  import: 'default',
  query: '?url',
})
const SPRITE_KEY_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.keys(SPRITE_LOADERS).map((path) => [path.split('/').pop() as string, path]),
)

export const hasFieldSprite = (filename: string) => SPRITE_KEY_BY_NAME[filename] !== undefined

const useFieldSprite = (filename: string) => {
  const spriteTexture = useLoader(TextureLoader, loadAssetUrl(SPRITE_LOADERS, SPRITE_KEY_BY_NAME[filename]))

  return useMemo(() => {
    spriteTexture.format = RGBAFormat
    spriteTexture.generateMipmaps = false
    spriteTexture.wrapS = ClampToEdgeWrapping
    spriteTexture.wrapT = ClampToEdgeWrapping
    spriteTexture.magFilter = NearestFilter
    spriteTexture.minFilter = NearestFilter
    spriteTexture.colorSpace = SRGBColorSpace

    return spriteTexture
  }, [spriteTexture])
}

export default useFieldSprite
