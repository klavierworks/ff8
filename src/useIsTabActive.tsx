import { useEffect, useState } from 'react'

const useIsTabActive = () => {
  const [isTabVisible, setIsTabVisible] = useState(true)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isTabVisible
}

export default useIsTabActive
