import { useEffect, useRef } from 'react'

export type HeldKeysRef = { current: Set<string> }

type UseHeldKeysProps = {
  onChange: (heldKeys: Set<string>, downCode: null | string) => void
  watchedCodes: readonly string[]
}

const useHeldKeys = ({ onChange, watchedCodes }: UseHeldKeysProps): HeldKeysRef => {
  const heldKeysRef = useRef<Set<string>>(new Set())
  const watchedSet = useRef(new Set(watchedCodes))
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    watchedSet.current = new Set(watchedCodes)
  }, [watchedCodes])

  useEffect(() => {
    const heldKeys = heldKeysRef.current

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!watchedSet.current.has(event.code)) {
        return
      }
      const wasAlreadyHeld = heldKeys.has(event.code)
      heldKeys.add(event.code)
      onChangeRef.current(heldKeys, wasAlreadyHeld ? null : event.code)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!watchedSet.current.has(event.code)) {
        return
      }
      heldKeys.delete(event.code)
      onChangeRef.current(heldKeys, null)
    }

    const handleClearKeys = () => {
      if (heldKeys.size === 0) {
        return
      }
      heldKeys.clear()
      onChangeRef.current(heldKeys, null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleClearKeys)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleClearKeys)
    }
  }, [])

  return heldKeysRef
}

export default useHeldKeys
