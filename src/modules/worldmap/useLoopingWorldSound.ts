import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { SFX_PAN_CENTRE } from '../../constants/audio'
import { getSoundFromId } from '../field/Scripts/Script/SFXController/utils'
import {
  AudioSourceNode,
  createAudioSource,
  playSource,
  setupUserActivation,
  setVolumeForSource,
  stopSource,
} from '../field/Scripts/Script/SFXController/webAudio'

const useLoopingWorldSound = (soundId: number | undefined, getVolume: () => number) => {
  const sourceRef = useRef<AudioSourceNode | null>(null)

  useEffect(() => {
    if (soundId === undefined) {
      return
    }
    setupUserActivation()
    let isCancelled = false

    createAudioSource(getSoundFromId(soundId), 0, SFX_PAN_CENTRE)
      .then((source) => {
        if (isCancelled) {
          return
        }
        sourceRef.current = source
        playSource(source)
      })
      .catch((error: unknown) => {
        console.warn(`Unable to start worldmap sound ${soundId}`, error)
      })

    return () => {
      isCancelled = true
      if (sourceRef.current) {
        stopSource(sourceRef.current)
        sourceRef.current = null
      }
    }
  }, [soundId])

  useFrame(() => {
    if (sourceRef.current) {
      setVolumeForSource(sourceRef.current, getVolume())
    }
  })
}

export default useLoopingWorldSound
