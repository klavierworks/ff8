import { useFrame } from '@react-three/fiber'

import useGlobalStore from '../../../store'
import { setCurrentLocationIndex } from '../Scripts/state'
import { buildWorldPosition } from '../worldPosition'

type LocationProps = {
  regionLocationIds: readonly number[]
}

const Location = ({ regionLocationIds }: LocationProps) => {
  useFrame(() => {
    const characterPosition = useGlobalStore.getState().characterPosition
    if (!characterPosition) {
      return
    }
    const { regionId } = buildWorldPosition(characterPosition.x, characterPosition.z)
    setCurrentLocationIndex(regionLocationIds[regionId] ?? 0)
  })

  return null
}

export default Location
