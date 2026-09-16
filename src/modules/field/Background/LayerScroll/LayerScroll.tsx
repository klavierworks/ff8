import { RefObject, useEffect } from 'react'

import useCameraScroll from '../../useScrollTransition'
import { LayerScrolls } from '../tileUtils'

type LayerScrollProps = {
  layerScrolls: RefObject<LayerScrolls>
  slot: number
}

const LayerScroll = ({ layerScrolls, slot }: LayerScrollProps) => {
  const scroll = useCameraScroll('layer', slot)

  useEffect(() => {
    const scrolls = layerScrolls.current
    scrolls[slot] = scroll
    return () => {
      delete scrolls[slot]
    }
  }, [layerScrolls, scroll, slot])

  return null
}

export default LayerScroll
