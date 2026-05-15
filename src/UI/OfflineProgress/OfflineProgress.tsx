import { Plane, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, ClampToEdgeWrapping } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../constants/constants'
import { offlineController } from '../../OfflineController'
import { fontLayout } from '../MessageBox/fontLayout'
import { getCharacterWidth } from '../MessageBox/messageBoxUtils'
import { Placement } from '../textTypes'

const SOURCE_TILE_SIZE = 95.8

const OUTPUT_TILE_SIZE = 24
const OUTPUT_HEIGHT_MODIFIER = 1
const OUTPUT_LINE_HEIGHT = OUTPUT_TILE_SIZE * OUTPUT_HEIGHT_MODIFIER * 1.4

const LEFT_MARGIN = OUTPUT_TILE_SIZE / 2
const TOP_MARGIN = OUTPUT_TILE_SIZE / 2

const OfflineProgress = () => {
  const [line, setLine] = useState('')
  useEffect(() => {
    const unsubscribe = offlineController.subscribe((state) => {
      const {
        progress: { current, total },
      } = state
      setLine(`${current} / ${total}`)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const textCanvas = useMemo(() => document.createElement('canvas'), [])
  const placements = useMemo(() => {
    let x = LEFT_MARGIN
    let y = TOP_MARGIN
    let highestX = 0

    const placements: Placement[] = []
    ;['Downloading:', line].forEach((line) => {
      line.split('').forEach((char) => {
        const rowIndex = fontLayout.findIndex((layoutRow) => layoutRow.includes(char))
        if (rowIndex < 0) {
          console.error(`Character not found in font layout: ${char}`)
          return
        }

        const columnIndex = fontLayout[rowIndex].indexOf(char)

        const character_width = getCharacterWidth({
          columnIndex,
          rowIndex,
        })

        placements.push({
          columnIndex,
          rowIndex,
          x,
          y,
        })

        x += character_width
        highestX = Math.max(highestX, x)
      })
      y += OUTPUT_LINE_HEIGHT
      x = LEFT_MARGIN
    })

    return placements
  }, [line])

  const whiteFont = useTexture('HDFont/merged_output/merged_white.png')
  useFrame(() => {
    const ctx = textCanvas.getContext('2d')
    if (!ctx) {
      return
    }

    textCanvas.width = SCREEN_WIDTH * 2
    textCanvas.height = SCREEN_HEIGHT * 2

    ctx.imageSmoothingEnabled = false

    const xPosWithoutScaling = 410
    const yPosWithoutScaling = 360

    const width = 220
    const height = 80
    const xPos = xPosWithoutScaling + width / 2 - width / 2
    const yPos = yPosWithoutScaling + height / 2 - height / 2

    const gradient = ctx.createLinearGradient(0, 0, width, 0)

    const alpha = 1
    gradient.addColorStop(0, `rgb(66,66,58,${alpha})`)
    gradient.addColorStop(1, `rgb(99,99,99,${alpha})`)

    ctx.fillStyle = gradient
    ctx.fillRect(xPos, yPos, width, height)

    ctx.strokeStyle = '#848484'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xPos, yPos)
    ctx.lineTo(xPos + width, yPos)
    ctx.moveTo(xPos, yPos)
    ctx.lineTo(xPos, yPos + height)
    ctx.stroke()

    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xPos + width, yPos)
    ctx.lineTo(xPos + width, yPos + height)
    ctx.moveTo(xPos, yPos + height)
    ctx.lineTo(xPos + width, yPos + height)
    ctx.stroke()

    placements.forEach((placement) => {
      const { columnIndex, rowIndex, x, y } = placement as Placement
      const font = whiteFont.image
      ctx.drawImage(
        font,
        columnIndex * SOURCE_TILE_SIZE,
        rowIndex * SOURCE_TILE_SIZE,
        SOURCE_TILE_SIZE,
        SOURCE_TILE_SIZE,
        xPos + x,
        yPos + y,
        OUTPUT_TILE_SIZE,
        OUTPUT_TILE_SIZE,
      )
    })
  })

  const texture = useMemo(() => new CanvasTexture(textCanvas), [textCanvas])
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true

  return (
    <Plane args={[SCREEN_WIDTH, SCREEN_HEIGHT, 1]} position={[SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, -1]}>
      <meshBasicMaterial map={texture} transparent />
    </Plane>
  )
}

export default OfflineProgress
