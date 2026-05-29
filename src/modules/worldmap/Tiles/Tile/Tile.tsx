import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'

import { SEGMENT_WORLD_SIZE, WORLD_GRID_COLS, WORLD_GRID_ROWS } from '../../constants'
import { TILE_ROOT_USER_DATA_KEY, TileRootUserData } from '../../tileRootUserData'
import { positiveModulo } from '../../worldPosition'
import { expandTileSeams, getSegmentBakedPosition, getTileUrl, getVariantBakedPosition } from '../tilesUtils'
import {
  collectAnimatedTextures,
  configureTileMesh,
  SEA_CYCLE_FRAME_COUNT,
  SEA_CYCLE_FRAME_WIDTH,
  SEA_CYCLE_FRAMES_PER_SECOND,
} from './tileUtils'

type TileBaseProps = {
  targetCol: number
  targetRow: number
}

type TileOffset = [number, number, number]

type TileProps = TileBaseProps &
  (
    | { offset: TileOffset; segmentIndex?: never; variantIndex: number }
    | { offset?: TileOffset; segmentIndex: number; variantIndex?: never }
  )

const Tile = ({ offset, segmentIndex, targetCol, targetRow, variantIndex }: TileProps) => {
  const { scene } = useGLTF(getTileUrl(segmentIndex, variantIndex))
  const { camera, gl } = useThree()
  const canonicalCol = positiveModulo(targetCol, WORLD_GRID_COLS)
  const canonicalRow = positiveModulo(targetRow, WORLD_GRID_ROWS)
  const canonicalSegmentIndex = canonicalRow * WORLD_GRID_COLS + canonicalCol

  const clonedScene = useMemo(() => {
    expandTileSeams(scene)
    const cloned = scene.clone(true)
    cloned.traverse(configureTileMesh)
    const baked =
      variantIndex !== undefined ? getVariantBakedPosition(variantIndex) : getSegmentBakedPosition(segmentIndex)
    const rootData: TileRootUserData = {
      canonicalSegmentIndex,
      psxOffsetX: (canonicalCol - baked.col) * SEGMENT_WORLD_SIZE,
      psxOffsetZ: (canonicalRow - baked.row) * SEGMENT_WORLD_SIZE,
    }
    cloned.userData[TILE_ROOT_USER_DATA_KEY] = rootData
    return cloned
  }, [scene, segmentIndex, canonicalCol, canonicalRow, canonicalSegmentIndex, variantIndex])

  const animatedTextures = useMemo(() => collectAnimatedTextures(clonedScene), [clonedScene])

  useLayoutEffect(() => {
    gl.compile(clonedScene, camera)
  }, [clonedScene, gl, camera])

  useFrame((state) => {
    if (animatedTextures.length === 0) {
      return
    }
    const frame = Math.floor(state.clock.elapsedTime * SEA_CYCLE_FRAMES_PER_SECOND) % SEA_CYCLE_FRAME_COUNT
    const offsetX = frame * SEA_CYCLE_FRAME_WIDTH
    animatedTextures.forEach((texture) => {
      texture.offset.x = offsetX
    })
  })

  return <primitive object={clonedScene} position={offset} />
}

export default Tile
