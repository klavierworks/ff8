import { invalidate, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Group, MathUtils } from 'three'

import { CARD_DEFINITIONS } from '../../../../constants/cardGame'
import {
  CARD_BACK_RECT,
  getCardFaceTile,
  getElementIconRect,
  getPowerRect,
  ICONS_SHEET_HEIGHT,
  ICONS_SHEET_WIDTH,
  MC_SHEET_HEIGHT,
  MC_SHEET_WIDTH,
} from '../../../../constants/cardGameAtlas'
import { CARD_LAYER, CARD_SIZE } from '../../../../constants/cardGameLayout'
import { MS_PER_FRAME } from '../../../../timing'
import AtlasSprite from '../../AtlasSprite/AtlasSprite'
import { CardOwner, Side } from '../../types'
import { CardGameTextures } from '../../useTextures'
import { calculateEntryBounce, calculateFlipPose, flipAxisForSide } from './cardAnimation'

type CardProps = {
  baseRenderOrder: number
  capturedSides?: Side[]
  centerX: number
  centerY: number
  definitionId: number
  entryAnimation?: 'none' | 'place'
  isFaceDown?: boolean
  isSelected?: boolean
  liftVector?: [number, number]
  owner: CardOwner
  scale?: number
  textures: CardGameTextures
}

const PLATE_COLOR: Record<CardOwner, string> = { opponent: '#ffc0e0', player: '#c0e0ff' }
const BACK_COLOR = '#607080'

const FACE_SIZE = 60
const DIGIT_SIZE = 11
const ELEMENT_SIZE = 13
const LIFT_LAMBDA = 14

// Corner-power diamond in the card's top-left (screen offsets from card centre, y-down).
const POWER_OFFSETS: Record<Side, [number, number]> = {
  bottom: [-19, -10],
  left: [-27, -18],
  right: [-11, -18],
  top: [-19, -26],
}

const Card = ({
  baseRenderOrder,
  capturedSides = [],
  centerX,
  centerY,
  definitionId,
  entryAnimation = 'none',
  isFaceDown = false,
  isSelected = false,
  liftVector = [0, 0],
  owner,
  scale = 1,
  textures,
}: CardProps) => {
  const groupRef = useRef<Group>(null)
  const definition = CARD_DEFINITIONS[definitionId]

  const [displayedOwner, setDisplayedOwner] = useState<CardOwner>(owner)
  const previousOwnerRef = useRef<CardOwner>(owner)
  const flipActiveRef = useRef(false)
  const flipAccumulatedRef = useRef(0)
  const flipAxisRef = useRef<'x' | 'y'>('y')
  const entryActiveRef = useRef(entryAnimation === 'place')
  const entryAccumulatedRef = useRef(0)
  const liftXRef = useRef(0)
  const liftYRef = useRef(0)

  useEffect(() => {
    if (previousOwnerRef.current === owner) {
      return
    }
    previousOwnerRef.current = owner
    if (isFaceDown) {
      setDisplayedOwner(owner)
      return
    }
    flipAxisRef.current = flipAxisForSide(capturedSides.at(-1))
    flipActiveRef.current = true
    flipAccumulatedRef.current = 0
    invalidate()
  }, [capturedSides, isFaceDown, owner])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }
    let isAnimating = false
    let bobY = 0
    let liftZ = 0
    let rotationX = 0
    let rotationY = 0
    const deltaMilliseconds = Math.min(delta * 1000, MS_PER_FRAME * 2)

    const [targetLiftX, targetLiftY] = isSelected ? liftVector : [0, 0]
    liftXRef.current = MathUtils.damp(liftXRef.current, targetLiftX, LIFT_LAMBDA, delta)
    liftYRef.current = MathUtils.damp(liftYRef.current, targetLiftY, LIFT_LAMBDA, delta)
    if (Math.abs(liftXRef.current - targetLiftX) > 0.05 || Math.abs(liftYRef.current - targetLiftY) > 0.05) {
      isAnimating = true
    }

    if (flipActiveRef.current) {
      isAnimating = true
      flipAccumulatedRef.current += deltaMilliseconds
      const frame = Math.floor(flipAccumulatedRef.current / MS_PER_FRAME)
      const pose = calculateFlipPose(frame, flipAxisRef.current)
      rotationX = pose.rotationX
      rotationY = pose.rotationY
      liftZ += pose.liftZ
      if (pose.shouldSwapOwner && displayedOwner !== owner) {
        setDisplayedOwner(owner)
      }
      if (pose.isDone) {
        flipActiveRef.current = false
      }
    }

    if (entryActiveRef.current) {
      isAnimating = true
      entryAccumulatedRef.current += deltaMilliseconds
      const bounce = calculateEntryBounce(Math.floor(entryAccumulatedRef.current / MS_PER_FRAME))
      bobY = bounce.bobY
      if (bounce.isDone) {
        entryActiveRef.current = false
      }
    }

    group.position.set(centerX + liftXRef.current, -centerY + liftYRef.current + bobY, liftZ)
    group.rotation.set(rotationX, rotationY, 0)
    if (isAnimating) {
      invalidate()
    }
  })

  const plateColor = isFaceDown ? BACK_COLOR : PLATE_COLOR[displayedOwner]
  const faceTile = getCardFaceTile(definitionId)

  return (
    <group position={[centerX, -centerY, 0]} ref={groupRef} scale={scale}>
      <mesh renderOrder={baseRenderOrder + CARD_LAYER.plate}>
        <planeGeometry args={[CARD_SIZE, CARD_SIZE]} />
        <meshBasicMaterial color={plateColor} depthTest={false} depthWrite={false} transparent />
      </mesh>

      {isFaceDown ? (
        <AtlasSprite
          height={64}
          rect={CARD_BACK_RECT}
          renderOrder={baseRenderOrder + CARD_LAYER.face}
          sheetHeight={MC_SHEET_HEIGHT}
          sheetWidth={MC_SHEET_WIDTH}
          texture={textures.mcSheets[0]}
          width={64}
        />
      ) : (
        <>
          <AtlasSprite
            height={FACE_SIZE}
            position={[0, 0, 0.1]}
            rect={faceTile.rect}
            renderOrder={baseRenderOrder + CARD_LAYER.face}
            sheetHeight={MC_SHEET_HEIGHT}
            sheetWidth={MC_SHEET_WIDTH}
            texture={textures.mcSheets[faceTile.sheetIndex]}
            width={FACE_SIZE}
          />

          {definition.element !== 'none' && (
            <AtlasSprite
              height={ELEMENT_SIZE}
              position={[22, 22, 0.2]}
              rect={getElementIconRect(definition.element)}
              renderOrder={baseRenderOrder + CARD_LAYER.element}
              sheetHeight={ICONS_SHEET_HEIGHT}
              sheetWidth={ICONS_SHEET_WIDTH}
              texture={textures.iconsSheet}
              width={ELEMENT_SIZE}
            />
          )}

          {(['top', 'left', 'right', 'bottom'] as const).map((side) => {
            const [offsetX, offsetY] = POWER_OFFSETS[side]
            return (
              <AtlasSprite
                height={DIGIT_SIZE}
                key={side}
                position={[offsetX, -offsetY, 0.3]}
                rect={getPowerRect(definition[side])}
                renderOrder={baseRenderOrder + CARD_LAYER.number}
                sheetHeight={ICONS_SHEET_HEIGHT}
                sheetWidth={ICONS_SHEET_WIDTH}
                texture={textures.iconsSheet}
                width={DIGIT_SIZE}
              />
            )
          })}
        </>
      )}
    </group>
  )
}

export default Card
