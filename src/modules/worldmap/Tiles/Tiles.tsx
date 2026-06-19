import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import useGlobalStore from '../../../store'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { WORLDMAP_SCALE } from '../constants'
import Tile from './Tile/Tile'
import TilePrecompiler from './TilePrecompiler/TilePrecompiler'
import {
  buildVariantOverrides,
  computeVisibleTiles,
  getWorldStateVariable,
  isDDistrictPrisonAboveGround,
  positionToSegmentColumn,
  positionToSegmentRow,
  preloadTileUrl,
  tileKey,
} from './tilesUtils'

type SegmentPosition = { column: number; row: number }

const Tiles = () => {
  const [segment, setSegment] = useState<null | SegmentPosition>(null)
  const segmentRef = useRef<null | SegmentPosition>(null)

  useFrame(() => {
    const position = useGlobalStore.getState().characterPosition
    if (!position) {
      return
    }
    const column = positionToSegmentColumn(position.x)
    const row = positionToSegmentRow(position.z)
    const current = segmentRef.current
    if (current && column === current.column && row === current.row) {
      return
    }
    segmentRef.current = { column, row }
    setSegment({ column, row })
  })

  const variantOverrides = useMemo(
    () => buildVariantOverrides(getWorldStateVariable(MEMORY), isDDistrictPrisonAboveGround(MEMORY)),
    [],
  )

  const visibleTiles = useMemo(
    () => (segment ? computeVisibleTiles(segment.column, segment.row, 3, variantOverrides) : []),
    [segment, variantOverrides],
  )

  const preloadTiles = useMemo(
    () => (segment ? computeVisibleTiles(segment.column, segment.row, 4, variantOverrides) : []),
    [segment, variantOverrides],
  )

  const visibleKeySet = useMemo(() => new Set(visibleTiles.map(tileKey)), [visibleTiles])

  const outerRingTiles = useMemo(
    () => preloadTiles.filter((tile) => !visibleKeySet.has(tileKey(tile))),
    [preloadTiles, visibleKeySet],
  )

  useEffect(() => {
    preloadTiles.forEach((tile) => {
      if (tile.kind === 'segment') {
        preloadTileUrl(tile.segmentIndex, undefined, useGLTF.preload)
      } else {
        preloadTileUrl(undefined, tile.variantIndex, useGLTF.preload)
      }
    })
  }, [preloadTiles])

  if (!segment) {
    return null
  }

  return (
    <group scale={WORLDMAP_SCALE}>
      {visibleTiles.map((tile) => (
        <Suspense fallback={null} key={tileKey(tile)}>
          {tile.kind === 'segment' ? (
            <Tile
              offset={tile.offset}
              segmentIndex={tile.segmentIndex}
              targetColumn={tile.targetColumn}
              targetRow={tile.targetRow}
            />
          ) : (
            <Tile
              offset={tile.offset}
              targetColumn={tile.targetColumn}
              targetRow={tile.targetRow}
              variantIndex={tile.variantIndex}
            />
          )}
        </Suspense>
      ))}
      {outerRingTiles.map((tile) => (
        <Suspense fallback={null} key={`pre/${tileKey(tile)}`}>
          {tile.kind === 'segment' ? (
            <TilePrecompiler segmentIndex={tile.segmentIndex} />
          ) : (
            <TilePrecompiler variantIndex={tile.variantIndex} />
          )}
        </Suspense>
      ))}
    </group>
  )
}

export default Tiles
