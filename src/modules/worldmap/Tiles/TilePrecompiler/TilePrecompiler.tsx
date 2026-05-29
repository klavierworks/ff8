import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

import { configureTileMesh } from '../Tile/tileUtils'
import { expandTileSeams, getTileUrl } from '../tilesUtils'

type TilePrecompilerProps =
  | { segmentIndex: number; variantIndex?: never }
  | { segmentIndex?: never; variantIndex: number }

const TilePrecompiler = ({ segmentIndex, variantIndex }: TilePrecompilerProps) => {
  const { scene } = useGLTF(getTileUrl(segmentIndex, variantIndex))
  const { camera, gl } = useThree()

  useLayoutEffect(() => {
    expandTileSeams(scene)
    scene.traverse(configureTileMesh)
    gl.compile(scene, camera)
  }, [scene, gl, camera])

  return null
}

export default TilePrecompiler
