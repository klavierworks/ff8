import { useEffect, useRef } from 'react'

type UseHeldKeysOptions = {
  onChange: (heldKeys: ReadonlySet<string>, pressedCode: null | string) => void
  watchedCodes: readonly string[]
}

const META_KEY_CODES: ReadonlySet<string> = new Set(['MetaLeft', 'MetaRight'])

const useHeldKeys = ({ onChange, watchedCodes }: UseHeldKeysOptions) => {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const heldKeys = new Set<string>()
    const watched = new Set(watchedCodes)

    const releaseAllKeys = () => {
      if (heldKeys.size === 0) {
        return
      }
      heldKeys.clear()
      onChangeRef.current(heldKeys, null)
    }

    // A non-repeat keydown for a key already marked held means its keyup never arrived, so it
    // still counts as a fresh press.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!watched.has(event.code)) {
        return
      }
      heldKeys.add(event.code)
      onChangeRef.current(heldKeys, event.repeat ? null : event.code)
    }

    // macOS browsers drop the keyup of any key released while Cmd is held.
    const handleKeyUp = (event: KeyboardEvent) => {
      if (META_KEY_CODES.has(event.code)) {
        releaseAllKeys()
        return
      }
      if (!watched.has(event.code)) {
        return
      }
      heldKeys.delete(event.code)
      onChangeRef.current(heldKeys, null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseAllKeys)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseAllKeys)
    }
  }, [watchedCodes])
}

export default useHeldKeys
