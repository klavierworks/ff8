import { useFrame } from '@react-three/fiber'
import { useState } from 'react'

import { BOAT_SOUND_ID, GARDEN_ENGINE_SOUND_ID, GARDEN_WATER_SOUND_ID } from '../../../constants/audio'
import { VEHICLE_IDS } from '../../../constants/vehicles'
import useLoopingWorldSound from '../useLoopingWorldSound'
import { isBoatClass } from '../vehicleClasses'
import useWorldmapStore from '../worldmapStore'
import {
  getBoatVolume,
  getCarEngineSoundId,
  getGardenWaterVolume,
  getGroundEngineVolume,
  getIsGardenOverWater,
} from './vehicleSoundUtils'

const VehicleSounds = () => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const [isGardenOverWater, setIsGardenOverWater] = useState(false)
  const isGarden = vehicleId === VEHICLE_IDS.BALAMB_GARDEN

  useLoopingWorldSound(getCarEngineSoundId(vehicleId), getGroundEngineVolume)
  useLoopingWorldSound(isGarden ? GARDEN_ENGINE_SOUND_ID : undefined, getGroundEngineVolume)
  useLoopingWorldSound(isGardenOverWater ? GARDEN_WATER_SOUND_ID : undefined, getGardenWaterVolume)
  useLoopingWorldSound(isBoatClass(vehicleId) ? BOAT_SOUND_ID : undefined, getBoatVolume)

  useFrame(() => {
    const isOverWater = getIsGardenOverWater()
    if (isOverWater !== isGardenOverWater) {
      setIsGardenOverWater(isOverWater)
    }
  })

  return null
}

export default VehicleSounds
