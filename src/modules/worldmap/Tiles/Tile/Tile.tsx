import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'

import { getTileUrl, prepareTileScene, TileOffset } from '../tilesUtils'
import { calculateSeaCycleOffsetX, collectAnimatedTextures } from './tileUtils'

type TileProps = {
  assetPath: string
  offset: TileOffset
}

const Tile = ({ assetPath, offset }: TileProps) => {
  const { scene } = useGLTF(getTileUrl(assetPath))
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const clonedScene = useMemo(() => prepareTileScene(scene).clone(true), [scene])
  const animatedTextures = useMemo(() => collectAnimatedTextures(clonedScene), [clonedScene])

  useLayoutEffect(() => {
    gl.compile(clonedScene, camera)
  }, [clonedScene, gl, camera])

  useFrame((state) => {
    const offsetX = calculateSeaCycleOffsetX(state.clock.elapsedTime)
    animatedTextures.forEach((texture) => {
      texture.offset.x = offsetX
    })
  })

  return <primitive object={clonedScene} position={offset} />
}

export default Tile
