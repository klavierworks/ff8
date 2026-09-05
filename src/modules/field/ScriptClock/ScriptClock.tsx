import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'

import useGlobalStore from '../../../store'
import { advanceScriptClock, releaseAllScriptWaiters } from '../scriptClock'

const ScriptClock = () => {
  useFrame((_, delta) => {
    if (useGlobalStore.getState().isCardGameActive) {
      return
    }
    advanceScriptClock(delta)
  })

  useEffect(() => {
    return () => {
      releaseAllScriptWaiters()
    }
  }, [])

  return null
}

export default ScriptClock
