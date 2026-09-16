import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import useGlobalStore from '../../../store'
import { useMovieStore } from '../movieController'
import { advanceScriptClock, advanceScriptClockToMovieFrame, releaseAllScriptWaiters } from '../scriptClock'
import { MEMORY } from '../Scripts/Script/handlers'

const ScriptClock = () => {
  const lastMovieFrameRef = useRef<number>(undefined)

  useFrame((_, delta) => {
    if (useGlobalStore.getState().isCardGameActive) {
      return
    }

    const { frame, isFieldMovieMode, playingMovie } = useMovieStore.getState()
    if (isFieldMovieMode) {
      MEMORY[80] = frame
    }

    if (!playingMovie) {
      lastMovieFrameRef.current = undefined
      advanceScriptClock(delta)
      return
    }
    if (frame === lastMovieFrameRef.current) {
      return
    }
    lastMovieFrameRef.current = frame
    advanceScriptClockToMovieFrame()
  })

  useEffect(() => {
    return () => {
      releaseAllScriptWaiters()
    }
  }, [])

  return null
}

export default ScriptClock
