import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'

import useGlobalStore from '../../../store'
import { SEGMENT_SIZE_THREE, WORLDMAP_SCALE } from '../constants'
import useWorldmapStore from '../worldmapStore'
import Clouds from './Clouds/Clouds'
import Gradient from './Gradient/Gradient'
import {
  areRgbTuplesEqual,
  createResolvedSkyColors,
  matchZone,
  resolveSkyColors,
  RgbTuple,
  SkyZone,
  STARS_ZONE_INDEX,
  toRgbTuple,
} from './skyUtils'
import Stars from './Stars/Stars'

type PsxPos = { x: number; y: number }

type SkyProps = {
  zones: readonly SkyZone[]
}

const Sky = ({ zones }: SkyProps) => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)

  const [psxPos, setPsxPos] = useState<null | PsxPos>(null)
  const posSegRef = useRef<null | { column: number; row: number }>(null)

  useFrame(() => {
    const pos = useGlobalStore.getState().characterPosition
    if (!pos) {
      return
    }
    const column = Math.floor(pos.x / SEGMENT_SIZE_THREE)
    const row = Math.floor(pos.z / SEGMENT_SIZE_THREE)
    const current = posSegRef.current
    if (current && column === current.column && row === current.row) {
      return
    }
    posSegRef.current = { column, row }
    const x = Math.round(pos.x / WORLDMAP_SCALE)
    const y = Math.round(pos.z / WORLDMAP_SCALE)
    setPsxPos((prev) => (prev?.x === x && prev?.y === y ? prev : { x, y }))
  })

  const resolved = useMemo(createResolvedSkyColors, [])
  const previousLight1 = useRef<RgbTuple>([0, 0, 0])
  const previousLight2 = useRef<RgbTuple>([0, 0, 0])

  const match = useMemo(() => {
    if (zones.length === 0) {
      return { blend: 0, index: 0 }
    }
    return matchZone(zones, psxPos?.x ?? 0, psxPos?.y ?? 0, vehicleId)
  }, [zones, psxPos, vehicleId])

  const colors = useMemo(() => {
    if (zones.length === 0) {
      return null
    }
    return resolveSkyColors(zones, match, resolved)
  }, [zones, match, resolved])

  useEffect(() => {
    if (!colors) {
      return
    }
    const nextLight1 = toRgbTuple(colors.lightColor1)
    const nextLight2 = toRgbTuple(colors.lightColor2)
    const isUnchanged =
      areRgbTuplesEqual(nextLight1, previousLight1.current) && areRgbTuplesEqual(nextLight2, previousLight2.current)
    if (isUnchanged) {
      return
    }
    previousLight1.current = nextLight1
    previousLight2.current = nextLight2
    useWorldmapStore.setState({
      skyLightColor1: nextLight1,
      skyLightColor2: nextLight2,
    })
  }, [colors])

  if (!colors) {
    return null
  }

  return (
    <>
      <Gradient horizon={colors.horizon} mid={colors.mid} zenith={colors.zenith} />
      <Clouds horizon={colors.horizon} />
      <Stars isEnabled={match.index === STARS_ZONE_INDEX} zenith={colors.zenith} />
    </>
  )
}

export default Sky
