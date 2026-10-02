import { useCallback, useLayoutEffect, useRef } from 'react'

import { beginFieldLoad, endFieldLoad } from './fieldLoadStore'

// Counts content behind its own Suspense boundary as pending until it calls the returned handler.
// A cached load can report before this registers, since a child's layout effect runs first.
const useFieldLoadTracking = () => {
  const hasLoadedRef = useRef(false)
  const isPendingRef = useRef(false)

  const settle = useCallback(() => {
    if (!isPendingRef.current) {
      return
    }
    isPendingRef.current = false
    endFieldLoad()
  }, [])

  useLayoutEffect(() => {
    if (hasLoadedRef.current) {
      return
    }
    isPendingRef.current = true
    beginFieldLoad()
    return settle
  }, [settle])

  return useCallback(() => {
    hasLoadedRef.current = true
    settle()
  }, [settle])
}

export default useFieldLoadTracking
