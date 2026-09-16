import { useMemo, useRef } from 'react'

import { FieldData } from '../Field'
import Layer from './Layer/Layer'
import LayerScroll from './LayerScroll/LayerScroll'
import { LayerScrolls } from './tileUtils'
import useLayeredTiles from './useLayeredTiles'

type BackgroundProps = {
  data: FieldData
}

const Background = ({ data }: BackgroundProps) => {
  const { backgroundDetails, layerWrap, tiles } = data

  const { layers, texture } = useLayeredTiles(tiles, backgroundDetails.sprite, layerWrap)
  const layerScrolls = useRef<LayerScrolls>({})
  const slots = useMemo(() => [...new Set(layers.map((layer) => layer.renderID))], [layers])

  return (
    <>
      {slots.map((slot) => (
        <LayerScroll key={slot} layerScrolls={layerScrolls} slot={slot} />
      ))}
      {layers.map((layer) => (
        <Layer key={layer.id} layer={layer} layerScrolls={layerScrolls} texture={texture} />
      ))}
    </>
  )
}

export default Background
