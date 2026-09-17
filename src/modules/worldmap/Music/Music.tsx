import { useEffect, useRef } from 'react'

import { musicController } from '../../../audio/activeMusicController'
import { FULL_MUSIC_VOLUME, WORLDMAP_MUSIC_CHANNEL, WORLDMAP_MUSIC_FADE_IN_FRAMES } from '../../../constants/audio'
import useWorldmapStore from '../worldmapStore'
import { getMusicStartMeasure, getTargetMusicId, getWorldmapMusicAction } from './musicUtils'

const Music = () => {
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const worldMapState = useWorldmapStore((state) => state.worldMapState)
  const playingMusicIdRef = useRef<null | number>(null)

  useEffect(() => {
    const targetMusicId = getTargetMusicId(vehicleId, worldMapState)
    const action = getWorldmapMusicAction({
      playingMusicId: playingMusicIdRef.current,
      targetMusicId,
      worldMapState,
    })

    if (action === 'mute') {
      musicController.setVolume(WORLDMAP_MUSIC_CHANNEL, 0)
      return
    }
    if (action === 'none') {
      return
    }

    if (playingMusicIdRef.current !== null) {
      musicController.pauseChannel(WORLDMAP_MUSIC_CHANNEL)
    }
    musicController.preloadMusic(targetMusicId, { startMeasure: getMusicStartMeasure(targetMusicId) })
    musicController.crossMusic(FULL_MUSIC_VOLUME, WORLDMAP_MUSIC_FADE_IN_FRAMES)
    playingMusicIdRef.current = targetMusicId
  }, [vehicleId, worldMapState])

  return null
}

export default Music
