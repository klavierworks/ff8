import { useEffect } from 'react'

import { musicController } from '../../../audio/activeMusicController'
import { FULL_MUSIC_VOLUME } from '../../../constants/audio'
import { VEHICLE_RAGNAROK } from '../Player/FlyingRagnarok/flightConstants'
import useWorldmapStore from '../worldmapStore'

const CROSSFADE_FRAMES = 60

// 41 is "Blue Fields", the default worldmap theme; 89 is "Ride On", the Ragnarok theme.
const WORLDMAP_MUSIC_ID = 41 as const
const RAGNAROK_MUSIC_ID = 89 as const

type WorldmapMusicId = typeof RAGNAROK_MUSIC_ID | typeof WORLDMAP_MUSIC_ID

// The MP3 rips carry an orchestral intro the sequencer never plays back.
const MUSIC_LOOP_START_SECONDS: Record<WorldmapMusicId, number> = {
  [RAGNAROK_MUSIC_ID]: 20,
  [WORLDMAP_MUSIC_ID]: 0,
}

const getMusicIdForVehicle = (vehicleId: number): WorldmapMusicId =>
  vehicleId === VEHICLE_RAGNAROK ? RAGNAROK_MUSIC_ID : WORLDMAP_MUSIC_ID

const Music = () => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)

  useEffect(() => {
    const musicId = getMusicIdForVehicle(vehicleId)
    musicController.preloadMusic(musicId, { loopStart: MUSIC_LOOP_START_SECONDS[musicId] })
    musicController.crossMusic(FULL_MUSIC_VOLUME, CROSSFADE_FRAMES)
  }, [vehicleId])

  return null
}

export default Music
