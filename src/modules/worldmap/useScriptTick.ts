import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import { getScriptFrame } from '../field/scriptClock'

type ScriptTickOptions = {
  priority?: number
  shouldSkipMountTick?: boolean
}

const useScriptTick = (
  onTick: (tick: number) => void,
  { priority, shouldSkipMountTick = false }: ScriptTickOptions = {},
) => {
  const lastTickRef = useRef(shouldSkipMountTick ? getScriptFrame() : -1)

  useFrame(() => {
    const tick = getScriptFrame()
    if (tick === lastTickRef.current) {
      return
    }
    lastTickRef.current = tick
    onTick(tick)
  }, priority)
}

export default useScriptTick
