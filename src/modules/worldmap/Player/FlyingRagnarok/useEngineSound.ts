import {
  RAGNAROK_ENGINE_BASE_VOLUME,
  RAGNAROK_ENGINE_MAX_VOLUME,
  RAGNAROK_ENGINE_SOUND_ID,
  RAGNAROK_ENGINE_SPEED_VOLUME_DIVISOR,
} from '../../../../constants/audio'
import { VEHICLE_IDS } from '../../../../constants/vehicles'
import useLoopingWorldSound from '../../useLoopingWorldSound'
import useWorldmapStore from '../../worldmapStore'
import { getRagnarokOutputs } from './ragnarokState'

const calculateEngineVolume = (psxSpeedPerFrame: number) =>
  Math.min(
    RAGNAROK_ENGINE_MAX_VOLUME,
    RAGNAROK_ENGINE_BASE_VOLUME + Math.floor(psxSpeedPerFrame / RAGNAROK_ENGINE_SPEED_VOLUME_DIVISOR),
  )

const getEngineVolume = () => calculateEngineVolume(Math.abs(getRagnarokOutputs().velocity))

const useEngineSound = () => {
  const isAboard = useWorldmapStore((state) => state.vehicleId === VEHICLE_IDS.RAGNAROK)
  useLoopingWorldSound(isAboard ? RAGNAROK_ENGINE_SOUND_ID : undefined, getEngineVolume)
}

export default useEngineSound
