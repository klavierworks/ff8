import { useEffect } from 'react'

const useToggleKey = (code: string, onToggle: () => void) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== code || event.repeat) {
        return
      }
      onToggle()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [code, onToggle])
}

export default useToggleKey
