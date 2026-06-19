import { invalidate, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'

import { BANNER_RECTS, BannerKey, ICONS_SHEET_HEIGHT, ICONS_SHEET_WIDTH } from '../../../../constants/cardGameAtlas'
import { RENDER_ORDER } from '../../../../constants/cardGameLayout'
import AtlasSprite from '../../AtlasSprite/AtlasSprite'
import { CardGameTextures } from '../../useTextures'

type BannerProps = {
  bannerKey: BannerKey
  centerX?: number
  centerY?: number
  textures: CardGameTextures
}

const POP_FRAMES = 15

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const Banner = ({ bannerKey, centerX = 160, centerY = 70, textures }: BannerProps) => {
  const groupRef = useRef<Group>(null)
  const frameRef = useRef(0)
  const rect = BANNER_RECTS[bannerKey]

  useFrame(() => {
    const group = groupRef.current
    if (!group || frameRef.current > POP_FRAMES) {
      return
    }
    const progress = Math.min(1, frameRef.current / POP_FRAMES)
    group.scale.setScalar(easeOutBack(progress))
    frameRef.current += 1
    invalidate()
  })

  return (
    <group position={[centerX, -centerY, 0]} ref={groupRef} scale={0}>
      <AtlasSprite
        height={rect.height}
        rect={rect}
        renderOrder={RENDER_ORDER.banner}
        sheetHeight={ICONS_SHEET_HEIGHT}
        sheetWidth={ICONS_SHEET_WIDTH}
        texture={textures.iconsSheet}
        width={rect.width}
      />
    </group>
  )
}

export default Banner
