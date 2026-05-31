import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { ClampToEdgeWrapping, NearestFilter, RGBAFormat, SRGBColorSpace, TextureLoader } from 'three'

const useTilesTexture = (filename: string) => {
  const tilesTexture = useLoader(TextureLoader, `/output/sprites/${filename}`)

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
