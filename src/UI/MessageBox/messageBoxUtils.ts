import { Modifier, Placement } from '../textTypes.ts'
import { createModifier } from '../textUtils.ts'
import { fontLayout, fontWidths } from './fontLayout.ts'

export const SOURCE_TILE_WIDTH = 96
export const SOURCE_TILE_HEIGHT = 96
export const OUTPUT_TILE_WIDTH = SOURCE_TILE_WIDTH / 4
export const OUTPUT_TILE_HEIGHT = SOURCE_TILE_HEIGHT / 4
export const SAFE_BOUNDS = 8
export const OUTPUT_LINE_HEIGHT = OUTPUT_TILE_HEIGHT * 1.4
export const OPTION_MARGIN = OUTPUT_TILE_WIDTH * 1.5
export const LEFT_MARGIN = OUTPUT_TILE_WIDTH / 2
export const TOP_MARGIN = OUTPUT_TILE_HEIGHT / 2

export const LETTER_SPACING = 3

export const getCharacterWidth = ({ columnIndex, rowIndex }: { columnIndex: number; rowIndex: number }): number => {
  const characterWidth = fontWidths[rowIndex][columnIndex]

  return OUTPUT_TILE_WIDTH * (characterWidth / 16)
}

export const getFontPosition = (char: string): null | { columnIndex: number; rowIndex: number } => {
  const rowIndex = fontLayout.findIndex((layoutRow) => layoutRow.includes(char))
  if (rowIndex < 0) {
    console.error(`Character not found in font layout: ${char}`)
    return null
  }
  const columnIndex = fontLayout[rowIndex].indexOf(char)

  return { columnIndex, rowIndex }
}

export const parseTextWithModifiers = (
  text: string,
  startX: number,
  startY: number,
  lineHeight: number = OUTPUT_LINE_HEIGHT,
): { finalY: number; maxX: number; placements: (Modifier | Placement)[] } => {
  const placements: (Modifier | Placement)[] = []
  let x = startX
  let y = startY
  let maxX = startX
  let hasOpenModifier = false
  let modifier = ''

  const processChar = (char: string) => {
    if (char === '{') {
      hasOpenModifier = true
      return
    }

    if (char === '}') {
      hasOpenModifier = false
      placements.push(createModifier(modifier))
      modifier = ''
      return
    }

    if (hasOpenModifier) {
      modifier += char
      return
    }

    const position = getFontPosition(char)
    if (!position) {
      return
    }

    const characterWidth = getCharacterWidth(position)

    placements.push({
      columnIndex: position.columnIndex,
      rowIndex: position.rowIndex,
      x,
      y,
    })

    x += characterWidth + LETTER_SPACING
    maxX = Math.max(maxX, x)
  }

  text.split('\n').forEach((line) => {
    line.split('').forEach(processChar)
    y += lineHeight
    x = startX
  })

  return { finalY: y, maxX, placements }
}

export const calculateSafePlacement = (
  message: { placement: { x?: number; y?: number } },
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number } => {
  const baseX = message.placement.x ?? 0
  const baseY = message.placement.y ?? 0

  const safeX = Math.max(baseX, SAFE_BOUNDS)
  const safeY = Math.max(baseY, SAFE_BOUNDS)

  const safeMaxX = screenWidth - SAFE_BOUNDS - width
  const safeMaxY = screenHeight - SAFE_BOUNDS - height

  const finalX = Math.min(safeX, safeMaxX)
  const finalY = Math.min(safeY, safeMaxY)

  return { x: finalX, y: finalY }
}

export const drawGradientBackground = (
  ctx: CanvasRenderingContext2D,
  xPos: number,
  yPos: number,
  width: number,
  height: number,
  mode: number,
): void => {
  if (mode === 2) {
    return
  }

  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  const alpha = mode === 0 ? 1 : 0.5
  gradient.addColorStop(0, `rgb(66,66,58,${alpha})`)
  gradient.addColorStop(1, `rgb(99,99,99,${alpha})`)

  ctx.fillStyle = gradient
  ctx.fillRect(xPos, yPos, width, height)
}

export const drawBorders = (
  ctx: CanvasRenderingContext2D,
  xPos: number,
  yPos: number,
  width: number,
  height: number,
): void => {
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
}

export const calculateScaledDimensions = (
  baseWidth: number,
  baseHeight: number,
  scale: number,
): { height: number; width: number; xOffset: number; yOffset: number } => {
  const width = baseWidth * scale
  const height = baseHeight * scale
  const xOffset = baseWidth / 2 - width / 2
  const yOffset = baseHeight / 2 - height / 2
  return { height, width, xOffset, yOffset }
}

export const updateScale = (currentScale: number, delta: number, speed: number): number => {
  if (currentScale >= 1) {
    return 1
  }
  const nextScale = currentScale + delta * speed
  return Math.min(nextScale, 1)
}

export const isBlinkOff = (progress: number, blinkDelay: number): boolean => {
  const positionInCycle = progress % blinkDelay
  return positionInCycle > blinkDelay / 2
}

const adjustBrightness = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  brightness: number,
) => {
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * brightness)
    data[i + 1] = Math.min(255, data[i + 1] * brightness)
    data[i + 2] = Math.min(255, data[i + 2] * brightness)
  }

  ctx.putImageData(imageData, x, y)
}

export const drawCharacter = (
  ctx: CanvasRenderingContext2D,
  fontImage: HTMLImageElement,
  placement: Placement,
  xPos: number,
  yPos: number,
  brightness: number,
  alpha: number = 1,
): void => {
  const { columnIndex, rowIndex, x, y } = placement
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = alpha

  ctx.drawImage(
    fontImage,
    columnIndex * SOURCE_TILE_WIDTH,
    rowIndex * SOURCE_TILE_HEIGHT,
    SOURCE_TILE_WIDTH,
    SOURCE_TILE_HEIGHT,
    xPos + x,
    yPos + y,
    OUTPUT_TILE_WIDTH,
    OUTPUT_TILE_HEIGHT,
  )

  adjustBrightness(ctx, xPos + x, yPos + y, OUTPUT_TILE_WIDTH, OUTPUT_TILE_HEIGHT, brightness)

  ctx.filter = 'none'
}

export const processTextLayout = (
  formattedText: null | string,
  options: null | string[],
  currentIndex: number,
  message: { placement: { channel?: number; height?: number; width?: number } },
): {
  height: number
  placements: (Modifier | Placement)[]
  selectedY: number
  width: number
} => {
  let highestX = 0
  const placements: (Modifier | Placement)[] = []

  if (formattedText) {
    const { maxX, placements: textPlacements } = parseTextWithModifiers(formattedText, LEFT_MARGIN, TOP_MARGIN)
    placements.push(...textPlacements)
    highestX = maxX
  }

  let selectedY = 0
  if (options) {
    let optionY = formattedText ? TOP_MARGIN + formattedText.split('\n').length * OUTPUT_LINE_HEIGHT : TOP_MARGIN

    options.forEach((line, index) => {
      if (index === currentIndex) {
        selectedY = optionY
      }
      const { maxX, placements: optionPlacements } = parseTextWithModifiers(line, LEFT_MARGIN + OPTION_MARGIN, optionY)
      placements.push(...optionPlacements)
      highestX = Math.max(highestX, maxX)
      optionY += OUTPUT_LINE_HEIGHT
    })
  }

  const finalY = formattedText
    ? TOP_MARGIN +
      formattedText.split('\n').length * OUTPUT_LINE_HEIGHT +
      (options ? options.length * OUTPUT_LINE_HEIGHT : 0)
    : TOP_MARGIN + (options ? options.length * OUTPUT_LINE_HEIGHT : 0)

  const width = message.placement.width ? message.placement.width * 2 : highestX + LEFT_MARGIN
  const height = message.placement.height ? message.placement.height * 2 : finalY + TOP_MARGIN / 2

  return { height, placements, selectedY, width }
}
