import { FieldData } from '../Field'
import Layer from './Layer/Layer'
import useLayeredTiles from './useLayeredTiles'

type BackgroundProps = {
  data: FieldData
}

const Background = ({ data }: BackgroundProps) => {
  const { backgroundDetails, limits, tiles } = data

  let width = Math.round(backgroundDetails.width / 16) * 16
  const horizontalRange = Math.abs(limits.cameraRange.left) + Math.abs(limits.cameraRange.right)
  if (width < horizontalRange) {
    width = horizontalRange
  }

  let height = Math.ceil(backgroundDetails.height / 16) * 16
  const verticalRange = Math.abs(limits.cameraRange.top) + Math.abs(limits.cameraRange.bottom)
  if (height < verticalRange) {
    height = verticalRange
  }

  const hasTiledRear = data.unknown[5] > 0

  const layers = useLayeredTiles(tiles, backgroundDetails.sprite, width, height, hasTiledRear)

  return layers.map((layer, index) => (
    <Layer isTiled={index === layers.length - 1 && hasTiledRear} key={layer.id} layer={layer} />
  ))
}

export default Background
