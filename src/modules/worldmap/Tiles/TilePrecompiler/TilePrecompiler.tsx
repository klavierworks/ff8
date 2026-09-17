import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

import { getTileUrl, prepareTileScene } from '../tilesUtils'

type TilePrecompilerProps = {
  assetPath: string
}

const TilePrecompiler = ({ assetPath }: TilePrecompilerProps) => {
  const { scene } = useGLTF(getTileUrl(assetPath))
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useLayoutEffect(() => {
    gl.compile(prepareTileScene(scene), camera)
  }, [scene, gl, camera])

  return null
}

export default TilePrecompiler
