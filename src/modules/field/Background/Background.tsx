import { FieldData } from '../Field'
import Layer from './Layer/Layer'
import useLayeredTiles from './useLayeredTiles'

type BackgroundProps = {
  data: FieldData
}

const Background = ({ data }: BackgroundProps) => {
  const { backgroundDetails, layerWrap, tiles } = data

  const { layers, texture } = useLayeredTiles(tiles, backgroundDetails.sprite, layerWrap)

  return layers.map((layer) => <Layer key={layer.id} layer={layer} texture={texture} />)
}

export default Background
