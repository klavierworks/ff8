import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import useGlobalStore from '../../../store'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { DRAW_DISTANCE, WORLDMAP_SCALE } from '../constants'
import { getWorldStateVariable } from '../worldmapSaveData'
import Tile from './Tile/Tile'
import TilePrecompiler from './TilePrecompiler/TilePrecompiler'
import { getActiveVariantOverrides } from './tileState'
import {
  getSegmentPosition,
  getTilesAround,
  isDDistrictPrisonAboveGround,
  preloadTileUrl,
  SegmentPosition,
} from './tilesUtils'

const BASE_VISIBLE_TILE_RADIUS = 3
const VISIBLE_TILE_RADIUS = Math.ceil(BASE_VISIBLE_TILE_RADIUS * DRAW_DISTANCE)
const PRELOAD_TILE_RADIUS = VISIBLE_TILE_RADIUS + 1

const isSameSegment = (a: null | SegmentPosition, b: SegmentPosition) => a?.column === b.column && a.row === b.row

const Tiles = () => {
  const [segment, setSegment] = useState<null | SegmentPosition>(null)
  const segmentRef = useRef<null | SegmentPosition>(null)

  useFrame(() => {
    const position = useGlobalStore.getState().characterPosition
    if (!position) {
      return
    }
    const next = getSegmentPosition(position)
    if (isSameSegment(segmentRef.current, next)) {
      return
    }
    segmentRef.current = next
    setSegment(next)
  })

  const variantOverrides = useMemo(
    () => getActiveVariantOverrides(getWorldStateVariable(MEMORY), isDDistrictPrisonAboveGround(MEMORY)),
    [],
  )

  const visibleTiles = useMemo(
    () => (segment ? getTilesAround(segment, VISIBLE_TILE_RADIUS, variantOverrides) : []),
    [segment, variantOverrides],
  )

  const preloadTiles = useMemo(
    () => (segment ? getTilesAround(segment, PRELOAD_TILE_RADIUS, variantOverrides) : []),
    [segment, variantOverrides],
  )

  const outerRingTiles = useMemo(() => {
    const visibleKeys = new Set(visibleTiles.map((tile) => tile.key))
    return preloadTiles.filter((tile) => !visibleKeys.has(tile.key))
  }, [preloadTiles, visibleTiles])

  useEffect(() => {
    preloadTiles.forEach((tile) => {
      preloadTileUrl(tile.assetPath, useGLTF.preload)
    })
  }, [preloadTiles])

  if (!segment) {
    return null
  }

  return (
    <group scale={WORLDMAP_SCALE}>
      {visibleTiles.map((tile) => (
        <Suspense fallback={null} key={tile.key}>
          <Tile assetPath={tile.assetPath} offset={tile.offset} />
        </Suspense>
      ))}
      {outerRingTiles.map((tile) => (
        <Suspense fallback={null} key={`preload/${tile.key}`}>
          <TilePrecompiler assetPath={tile.assetPath} />
        </Suspense>
      ))}
    </group>
  )
}

export default Tiles
