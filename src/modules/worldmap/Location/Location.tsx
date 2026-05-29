import { useFrame } from '@react-three/fiber'

import useGlobalStore from '../../../store'
import { WORLDMAP_STATE } from '../Scripts/state'
import { buildWorldPosition } from '../worldPosition'

type LocationProps = {
  regionLocationIds: readonly number[]
}

const Location = ({ regionLocationIds }: LocationProps) => {
  useFrame(() => {
    const current = useGlobalStore.getState().characterPosition
    if (!current) {
      return
    }
    const player = buildWorldPosition(current.x, current.z)
    const next = regionLocationIds[player.regionId] ?? 0
    if (next === WORLDMAP_STATE.currentLocationIndex) {
      return
    }
    WORLDMAP_STATE.previousLocationIndex = WORLDMAP_STATE.currentLocationIndex
    WORLDMAP_STATE.currentLocationIndex = next
  })
  return null
}

export default Location
