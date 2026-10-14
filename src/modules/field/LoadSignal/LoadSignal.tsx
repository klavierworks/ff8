import { useLayoutEffect } from 'react'

type LoadSignalProps = {
  onLoad: () => void
}

const LoadSignal = ({ onLoad }: LoadSignalProps) => {
  useLayoutEffect(onLoad, [onLoad])

  return null
}

export default LoadSignal
