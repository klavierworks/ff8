import { useEffect, useRef } from 'react'

type UseHeldKeysOptions = {
  onChange: (heldKeys: ReadonlySet<string>, pressedCode: null | string) => void
  watchedCodes: readonly string[]
}

const useHeldKeys = ({ onChange, watchedCodes }: UseHeldKeysOptions) => {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const heldKeys = new Set<string>()
    const watched = new Set(watchedCodes)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!watched.has(event.code)) {
        return
      }
      const wasAlreadyHeld = heldKeys.has(event.code)
      heldKeys.add(event.code)
      onChangeRef.current(heldKeys, wasAlreadyHeld ? null : event.code)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!watched.has(event.code)) {
        return
      }
      heldKeys.delete(event.code)
      onChangeRef.current(heldKeys, null)
    }

    const handleBlur = () => {
      if (heldKeys.size === 0) {
        return
      }
      heldKeys.clear()
      onChangeRef.current(heldKeys, null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [watchedCodes])
}

export default useHeldKeys
