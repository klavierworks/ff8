import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'

import useGlobalStore from '../../../store'
import { MEMORY } from '../../field/Scripts/Script/handlers'
import { worldXToPsx, worldZToPsx } from '../Player/playerUtils'
import { getWorldStateVariable } from '../worldmapSaveData'
import useWorldmapStore from '../worldmapStore'
import Clouds from './Clouds/Clouds'
import Gradient from './Gradient/Gradient'
import {
  calculateHorizonScreenY,
  createSkyColors,
  findSkyZoneMatch,
  publishSkyLightColors,
  SkyZone,
  STARS_ZONE_INDEX,
  updateSkyColors,
} from './skyUtils'
import Stars from './Stars/Stars'

type SkyProps = {
  zones: readonly SkyZone[]
}

const Sky = ({ zones }: SkyProps) => {
  const colors = useMemo(createSkyColors, [])
  const horizonYRef = useRef(0)
  const [isStarsZone, setIsStarsZone] = useState(false)

  useFrame(({ camera }) => {
    const position = useGlobalStore.getState().characterPosition
    if (!position || zones.length === 0) {
      return
    }
    horizonYRef.current = calculateHorizonScreenY(camera, position, useWorldmapStore.getState().camera)
    const match = findSkyZoneMatch(
      zones,
      worldXToPsx(position.x),
      worldZToPsx(position.z),
      getWorldStateVariable(MEMORY),
    )
    updateSkyColors(colors, zones, match)
    setIsStarsZone(match.index === STARS_ZONE_INDEX)
    publishSkyLightColors(colors)
  })

  if (zones.length === 0) {
    return null
  }

  return (
    <>
      <Gradient horizon={colors.horizon} horizonYRef={horizonYRef} mid={colors.mid} zenith={colors.zenith} />
      <Clouds horizon={colors.horizon} horizonYRef={horizonYRef} />
      <Stars isEnabled={isStarsZone} zenith={colors.zenith} />
    </>
  )
}

export default Sky
