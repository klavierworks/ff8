import { useEffect } from 'react'

import useGlobalStore from '../store'

type LoadingControllerProps = {
  isControllingFadeIn?: boolean
}
const LoadingController = ({ isControllingFadeIn = false }: LoadingControllerProps) => {
  useEffect(() => {
    useGlobalStore.setState({ isLoading: true })
    return () => {
      useGlobalStore.setState({ isLoading: false })
    }
  }, [isControllingFadeIn])

  return null
}

export default LoadingController
