import { useEffect } from 'react'

import { musicController } from '../../../audio/MusicController'
import { MUSIC_IDS } from '../../../constants/audio'
import { VEHICLE_RAGNAROK } from '../Player/FlyingRagnarok/flightConstants'
import useWorldmapStore from '../worldmapStore'

const CROSSFADE_FRAMES = 60
const FULL_VOLUME = 127

// Song ids from the original worldmap music selector:
//   41 = "Blue Fields" — default worldmap theme
//   89 = "Ride On" — Ragnarok theme
// Both crossfade over CROSSFADE_FRAMES at FULL_VOLUME on a vehicle change.
const WORLDMAP_MUSIC_ID = 41 as const
const RAGNAROK_MUSIC_ID = 89 as const

type WorldmapMusicId = typeof RAGNAROK_MUSIC_ID | typeof WORLDMAP_MUSIC_ID

// Per-track intro skip (seconds). The PSX AKAO/SGT sequencer starts each track
// from its main theme; the shipped MP3 rips include the original orchestral
// intro that the engine never plays back. "Ride On" has a ~20s intro before
// the main theme begins.
const MUSIC_LOOP_START_SECONDS: Record<WorldmapMusicId, number> = {
  [RAGNAROK_MUSIC_ID]: 20,
  [WORLDMAP_MUSIC_ID]: 0,
}

const musicIdForVehicle = (vehicleId: number): WorldmapMusicId =>
  vehicleId === VEHICLE_RAGNAROK ? RAGNAROK_MUSIC_ID : WORLDMAP_MUSIC_ID

const Music = () => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)

  useEffect(() => {
    const musicId = musicIdForVehicle(vehicleId)
    musicController.preloadMusic(MUSIC_IDS[musicId], { loopStart: MUSIC_LOOP_START_SECONDS[musicId] })
    musicController.crossMusic(FULL_VOLUME, CROSSFADE_FRAMES)
  }, [vehicleId])

  return null
}

export default Music
