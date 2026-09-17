import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute } from 'three'

import useGlobalStore from '../../../../../store'
import { MAP_RENDER_ORDER, PLANET_CENTER_X, PLANET_CENTER_Y } from '../../constants'
import CharaPointer from '../CharaPointer/CharaPointer'
import { createPsxMaterial } from '../psxPrimitives'
import { MinimapTextures } from '../useMinimapTextures'
import {
  calculatePlanetTexels,
  calculatePlanetTextureOrigin,
  createPlanetGeometry,
  isSameTextureOrigin,
  PlanetTextureOrigin,
} from './planetUtils'

type PlanetViewProps = {
  textures: MinimapTextures
}

const PlanetView = ({ textures }: PlanetViewProps) => {
  const geometry = useMemo(createPlanetGeometry, [])
  const material = useMemo(() => createPsxMaterial('opaque', textures.colorMap), [textures.colorMap])
  const originRef = useRef<PlanetTextureOrigin | undefined>(undefined)

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const position = useGlobalStore.getState().characterPosition
    if (!position) {
      return
    }
    const origin = calculatePlanetTextureOrigin(position.x, position.z)
    if (originRef.current && isSameTextureOrigin(originRef.current, origin)) {
      return
    }
    originRef.current = origin
    const texelAttribute = geometry.getAttribute('texel') as BufferAttribute
    texelAttribute.copyArray(calculatePlanetTexels(origin))
    texelAttribute.needsUpdate = true
  })

  return (
    <>
      <mesh frustumCulled={false} geometry={geometry} material={material} renderOrder={MAP_RENDER_ORDER} />
      <CharaPointer cellScale={0} originX={PLANET_CENTER_X} originY={PLANET_CENTER_Y} textures={textures} />
    </>
  )
}

export default PlanetView
