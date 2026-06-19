import { useEffect, useMemo } from 'react'
import { DoubleSide, PlaneGeometry, Texture } from 'three'

import { AtlasRect } from '../../../constants/cardGameAtlas'

type AtlasSpriteProps = {
  color?: string
  height: number
  opacity?: number
  position?: [number, number, number]
  rect: AtlasRect
  renderOrder?: number
  sheetHeight: number
  sheetWidth: number
  texture: Texture
  visible?: boolean
  width: number
}

const AtlasSprite = ({
  color,
  height,
  opacity = 1,
  position = [0, 0, 0],
  rect,
  renderOrder = 0,
  sheetHeight,
  sheetWidth,
  texture,
  visible = true,
  width,
}: AtlasSpriteProps) => {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, height)
    const left = rect.x / sheetWidth
    const right = (rect.x + rect.width) / sheetWidth
    const top = rect.y / sheetHeight
    const bottom = (rect.y + rect.height) / sheetHeight
    const uv = plane.attributes.uv
    uv.setXY(0, left, top)
    uv.setXY(1, right, top)
    uv.setXY(2, left, bottom)
    uv.setXY(3, right, bottom)
    uv.needsUpdate = true
    return plane
  }, [width, height, rect.x, rect.y, rect.width, rect.height, sheetWidth, sheetHeight])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={position} renderOrder={renderOrder} visible={visible}>
      <meshBasicMaterial
        color={color}
        depthTest={false}
        depthWrite={false}
        map={texture}
        opacity={opacity}
        side={DoubleSide}
        transparent
      />
    </mesh>
  )
}

export default AtlasSprite
