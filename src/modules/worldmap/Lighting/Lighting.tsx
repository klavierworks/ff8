import { useMemo } from 'react'
import { Color } from 'three'

import useWorldmapStore from '../worldmapStore'

const Lighting = () => {
  const PSX_VERTEX_NEUTRAL = 128
  const AMBIENT_INTENSITY = 255 / PSX_VERTEX_NEUTRAL
  const HEMISPHERE_INTENSITY = 0.6

  const byteRgbToColor = (rgb: readonly [number, number, number], target: Color): Color =>
    target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)

  const skyLightColor1 = useWorldmapStore((state) => state.skyLightColor1)
  const skyLightColor2 = useWorldmapStore((state) => state.skyLightColor2)

  const groundColor = useMemo(() => byteRgbToColor(skyLightColor2, new Color()), [skyLightColor2])
  const hemisphereSky = useMemo(() => byteRgbToColor(skyLightColor1, new Color()), [skyLightColor1])

  return (
    <>
      <ambientLight color={groundColor} intensity={AMBIENT_INTENSITY} />
      <hemisphereLight color={hemisphereSky} groundColor={groundColor} intensity={HEMISPHERE_INTENSITY} />
    </>
  )
}

export default Lighting
