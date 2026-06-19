import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { NearestFilter, Texture, TextureLoader } from 'three'

import { BOARD_IMAGE_WIDTH, RENDER_ORDER } from '../../../../constants/cardGameLayout'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../constants/constants'

const BOARD_URL = Object.values(
  import.meta.glob<string>('/extractor/data/converted/exe/cardgame_board/*.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
)[0]

const configureBoard = (texture: Texture) => {
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.flipY = true
  texture.needsUpdate = true
  return texture
}

const Background = () => {
  const board = useLoader(TextureLoader, BOARD_URL)
  const texture = useMemo(() => configureBoard(board), [board])

  return (
    <mesh position={[SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, 0]} renderOrder={RENDER_ORDER.background}>
      <planeGeometry args={[BOARD_IMAGE_WIDTH, SCREEN_HEIGHT]} />
      <meshBasicMaterial depthTest={false} depthWrite={false} map={texture} />
    </mesh>
  )
}

export default Background
