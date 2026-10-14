import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { ClampToEdgeWrapping, NearestFilter, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'

import { getAssetUrl } from '../../assetManifest'

// Field sprite sheets live alongside their field data as `<field>/<field>*.png`.
const useFieldSprite = (fieldId: string, filename: string) => {
  const spriteTexture = useLoader(TextureLoader, getAssetUrl(`field/mapdata/${fieldId}/${filename}`))

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
