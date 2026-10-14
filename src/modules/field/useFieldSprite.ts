import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { ClampToEdgeWrapping, NearestFilter, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'

import { getAssetUrl, listAssets } from '../../assetManifest'

// Field sprite sheets live alongside their field data as `<field>/<field>*.png`; callers pass
// only the filename.
const SPRITE_PATH_BY_NAME: Record<string, string> = Object.fromEntries(
  listAssets('field/mapdata/')
    .filter((path) => path.endsWith('.png'))
    .map((path) => [path.split('/').pop() as string, path]),
)

export const hasFieldSprite = (filename: string) => SPRITE_PATH_BY_NAME[filename] !== undefined

const useFieldSprite = (filename: string) => {
  const spriteTexture = useLoader(TextureLoader, getAssetUrl(SPRITE_PATH_BY_NAME[filename]))

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
