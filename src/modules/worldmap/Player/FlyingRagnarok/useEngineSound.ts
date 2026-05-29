import { useFrame } from '@react-three/fiber'
import { Howl } from 'howler'
import { MutableRefObject, useEffect, useRef } from 'react'

import { TARGET_FPS } from '../../../../timing'
import { WORLDMAP_SCALE } from '../../constants'
import useWorldmapStore from '../../worldmapStore'
import { VEHICLE_RAGNAROK } from './flightConstants'

const RAGNAROK_TOP_SPEED = 200 * TARGET_FPS * WORLDMAP_SCALE
import { FlightAttitude } from './useFlight'

// The Ragnarok engine loop (PSX asset 500002, see ida.md) starts on the first
// frame aboard the Ragnarok and stops when the player dismounts. Volume is the
// idle baseline plus speed / 4, clamped to 0..127 — it modulates upward with
// ground velocity.
//
// That PSX sound id isn't present in the port's audio extraction yet. Once the
// wave is extracted, set RAGNAROK_ENGINE_SOUND_URL to its path — until then the
// hook stays silent but the wiring is verified.
const RAGNAROK_ENGINE_SOUND_URL: null | string = null

// PSX volume → Howler 0..1 — full-range volume in the original is 127.
const PSX_VOLUME_MAX = 127
const IDLE_VOLUME = 80
// Per-axis speed scaling: PSX `speed / 4` over `[0, 200] PSX/frame` adds up
// to ~50 above the idle baseline at top speed. Stay in PSX units for clarity.
const ragnarokVolumeForSpeed = (speed: number): number => {
  const speedFraction = Math.min(1, Math.max(0, speed / RAGNAROK_TOP_SPEED))
  const psxVolume = IDLE_VOLUME + speedFraction * (PSX_VOLUME_MAX - IDLE_VOLUME)
  return Math.min(1, psxVolume / PSX_VOLUME_MAX)
}

type UseEngineSoundArgs = {
  attitudeRef: MutableRefObject<FlightAttitude>
}

const useEngineSound = ({ attitudeRef }: UseEngineSoundArgs) => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const howlRef = useRef<Howl | null>(null)
  const soundIdRef = useRef<null | number>(null)

  useEffect(() => {
    if (!RAGNAROK_ENGINE_SOUND_URL) {
      return
    }
    if (vehicleId !== VEHICLE_RAGNAROK) {
      return
    }
    const howl = new Howl({
      autoplay: false,
      loop: true,
      preload: true,
      src: [RAGNAROK_ENGINE_SOUND_URL],
      volume: ragnarokVolumeForSpeed(0),
    })
    howlRef.current = howl
    soundIdRef.current = howl.play()
    return () => {
      howl.stop()
      howl.unload()
      howlRef.current = null
      soundIdRef.current = null
    }
  }, [vehicleId])

  useFrame(() => {
    if (!RAGNAROK_ENGINE_SOUND_URL) {
      return
    }
    const howl = howlRef.current
    const soundId = soundIdRef.current
    if (!howl || soundId === null) {
      return
    }
    howl.volume(ragnarokVolumeForSpeed(attitudeRef.current.speed), soundId)
  })
}

export default useEngineSound
