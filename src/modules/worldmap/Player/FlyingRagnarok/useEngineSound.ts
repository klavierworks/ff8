import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import {
  RAGNAROK_ENGINE_BASE_VOLUME,
  RAGNAROK_ENGINE_MAX_VOLUME,
  RAGNAROK_ENGINE_SOUND_ID,
  RAGNAROK_ENGINE_SPEED_VOLUME_DIVISOR,
  SFX_PAN_CENTRE,
} from '../../../../constants/audio'
import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { getSoundFromId } from '../../../field/Scripts/Script/SFXController/utils'
import {
  AudioSourceNode,
  createAudioSource,
  playSource,
  setupUserActivation,
  setVolumeForSource,
  stopSource,
} from '../../../field/Scripts/Script/SFXController/webAudio'
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
  const sourceRef = useRef<AudioSourceNode | null>(null)

  useEffect(() => {
    if (!isAboard) {
      return
    }

    setupUserActivation()
    let isCancelled = false

    createAudioSource(getSoundFromId(RAGNAROK_ENGINE_SOUND_ID), getEngineVolume(), SFX_PAN_CENTRE)
      .then((source) => {
        if (isCancelled) {
          return
        }
        sourceRef.current = source
        playSource(source)
      })
      .catch((error: unknown) => {
        console.warn('Unable to start the Ragnarok engine sound', error)
      })

    return () => {
      isCancelled = true
      if (sourceRef.current) {
        stopSource(sourceRef.current)
        sourceRef.current = null
      }
    }
  }, [isAboard])

  useFrame(() => {
    if (!sourceRef.current) {
      return
    }
    setVolumeForSource(sourceRef.current, getEngineVolume())
  })
}

export default useEngineSound
