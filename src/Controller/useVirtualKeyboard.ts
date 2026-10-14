import { useCallback, useEffect, useRef } from 'react'

import { CONTROLS_MAP } from '../constants/controls'
import { calculateKeyChanges, KeyChanges, mergeKeySets } from './controllerUtils'

const EMPTY_KEYS: ReadonlySet<string> = new Set()

const dispatchKeyChanges = ({ pressed, released }: KeyChanges, isShiftHeld: boolean) => {
  released.forEach((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey: isShiftHeld })))
  pressed.forEach((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: isShiftHeld })))
}

const useVirtualKeyboard = () => {
  const sourcesRef = useRef<ReadonlyMap<string, ReadonlySet<string>>>(new Map())
  const heldKeysRef = useRef<ReadonlySet<string>>(EMPTY_KEYS)

  const applyHeldKeys = useCallback((nextKeys: ReadonlySet<string>) => {
    dispatchKeyChanges(calculateKeyChanges(heldKeysRef.current, nextKeys), nextKeys.has(CONTROLS_MAP.walk))
    heldKeysRef.current = nextKeys
  }, [])

  const setSourceKeys = useCallback(
    (source: string, keys: ReadonlySet<string>) => {
      sourcesRef.current = new Map(sourcesRef.current).set(source, keys)
      applyHeldKeys(mergeKeySets(sourcesRef.current.values()))
    },
    [applyHeldKeys],
  )

  useEffect(() => {
    const releaseAllKeys = () => {
      sourcesRef.current = new Map()
      applyHeldKeys(EMPTY_KEYS)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        releaseAllKeys()
      }
    }

    window.addEventListener('blur', releaseAllKeys)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', releaseAllKeys)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseAllKeys()
    }
  }, [applyHeldKeys])

  return setSourceKeys
}

export default useVirtualKeyboard
