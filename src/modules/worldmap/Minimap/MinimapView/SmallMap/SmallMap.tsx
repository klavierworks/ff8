import { useEffect, useMemo } from 'react'

import { MAP_RENDER_ORDER, SMALL_MAP_LEFT, SMALL_MAP_TOP } from '../../constants'
import CharaPointer from '../CharaPointer/CharaPointer'
import { createPsxMaterial } from '../psxPrimitives'
import { MinimapTextures } from '../useMinimapTextures'
import { createSmallMapGeometry } from './smallMapUtils'

type SmallMapProps = {
  textures: MinimapTextures
}

const SmallMap = ({ textures }: SmallMapProps) => {
  const geometry = useMemo(createSmallMapGeometry, [])
  const material = useMemo(() => createPsxMaterial('half', textures.greyscaleMap), [textures.greyscaleMap])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      <mesh frustumCulled={false} geometry={geometry} material={material} renderOrder={MAP_RENDER_ORDER} />
      <CharaPointer cellScale={1} originX={SMALL_MAP_LEFT} originY={SMALL_MAP_TOP} textures={textures} />
    </>
  )
}

export default SmallMap
