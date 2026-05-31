import { Plane, useTexture } from '@react-three/drei'
import { invalidate, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, Scene, Texture } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../constants/constants'
import { CONTROLS_MAP } from '../../constants/controls.ts'
import { saveGame } from '../../modules/field/fieldUtils.ts'
import { closeMessage } from '../../modules/field/Scripts/Script/utils.ts'
import useGlobalStore from '../../store.ts'
import { framesToMs, TARGET_FPS } from '../../timing.ts'
import { FontColor, Modifier, Placement } from '../textTypes.ts'
import { formatNameTags } from '../textUtils.ts'
import {
  calculateSafePlacement,
  calculateScaledDimensions,
  drawBorders,
  drawCharacter,
  drawGradientBackground,
  isBlinkOff,
  LEFT_MARGIN,
  OUTPUT_TILE_HEIGHT,
  OUTPUT_TILE_WIDTH,
  processTextLayout,
  updateScale,
} from './messageBoxUtils'

type MessageBoxProps = {
  isCloseableFocus: boolean
  isSavePoint: boolean
  message: Message
  worldScene: Scene
}

const OPEN_SPEED = 3
const FONT_SPEED_UNIT = 4096
const SPEED_MULTIPLIER = 2
const BLINK_DELAY = 240

const MessageBox = ({ isCloseableFocus, isSavePoint, message, worldScene }: MessageBoxProps) => {
  const { askOptions, id, isCloseable, text } = isSavePoint
    ? {
        ...message,
        askOptions: {
          cancel: 1,
          default: 2,
          first: 2,
        },
        text: [`【Save Point】\nSave the game?\nYes\nNo`],
      }
    : message

  const textCanvas = useMemo(() => document.createElement('canvas'), [])

  const background = useTexture('message_background.png')
  background.wrapS = RepeatWrapping
  background.wrapT = RepeatWrapping
  background.repeat.set(0.7, 40)
  background.needsUpdate = true

  const white = useTexture('HDFont/merged_output/merged_white.png')
  const red = useTexture('HDFont/merged_output/merged_red.png')
  const blue = useTexture('HDFont/merged_output/merged_blue.png')
  const green = useTexture('HDFont/merged_output/merged_green.png')
  const yellow = useTexture('HDFont/merged_output/merged_yellow.png')
  const magenta = useTexture('HDFont/merged_output/merged_magenta.png')
  const gray = useTexture('HDFont/merged_output/merged_gray.png')
  const shadow = useTexture('HDFont/merged_output/merged_shadow.png')
  const cursor = useTexture('cursor.png')

  const fontTextures: Record<FontColor, Texture> = useMemo(
    () => ({
      blue,
      gray,
      green,
      magenta,
      red,
      shadow,
      white,
      yellow,
    }),
    [white, red, blue, green, yellow, magenta, gray, shadow],
  )

  const [currentPage, setCurrentPage] = useState(0)
  const [currentIndex, setCurrentIndex] = useState((askOptions?.default ?? 0) - (askOptions?.first ?? 0))
  const [hasDisplayedAllText, setHasDisplayedAllText] = useState(false)

  const isActive = currentPage < text.length

  useEffect(() => {
    if (!isActive) {
      closeMessage(id, currentIndex)
    }
  }, [currentIndex, id, isActive])

  const [formattedText, options] = useMemo(() => {
    if (currentPage >= text.length) {
      return [null, null]
    }

    const sanitisedText = formatNameTags(text[currentPage])

    if (!askOptions) {
      return [sanitisedText, null]
    }

    const splitLines = sanitisedText.split('\n')
    const options = splitLines.slice(askOptions.first, askOptions.last ? askOptions.last + 1 : splitLines.length)
    const originalText = splitLines.slice(0, askOptions.first).join('\n')

    if (originalText.length === 0) {
      return [null, options]
    }

    return [originalText, options]
  }, [text, currentPage, askOptions])

  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      const event = e as unknown as KeyboardEvent

      if (!hasDisplayedAllText) {
        return
      }

      if (!options && event.code === CONTROLS_MAP.confirm && isCloseable) {
        setCurrentPage((prev) => prev + 1)
        return
      }

      if (!options) {
        return
      }

      if (event.code === CONTROLS_MAP.confirm) {
        if (isSavePoint && currentIndex === 0) {
          saveGame(worldScene)
        }
        if (options[currentIndex].includes('{Grey}')) {
          useGlobalStore.getState().systemSfxController.play(16, 0, 127, 128)
          return
        }

        if (askOptions && currentIndex !== askOptions.cancel) {
          const confirmId = isSavePoint ? 28 : 1
          useGlobalStore.getState().systemSfxController.play(confirmId, 0, 127, 128)
        }

        if (askOptions && currentIndex === askOptions.cancel) {
          useGlobalStore.getState().systemSfxController.play(9, 0, 127, 128)
        }
        setCurrentPage((prev) => prev + 1)
      }

      if (event.code === CONTROLS_MAP.cancel && askOptions && askOptions.cancel !== undefined) {
        useGlobalStore.getState().systemSfxController.play(9, 0, 127, 128)
        setCurrentIndex(askOptions.cancel)
        setCurrentPage((prev) => prev + 1)
      }

      if (event.code === 'ArrowUp') {
        useGlobalStore.getState().systemSfxController.play(1, 0, 127, 128)
        invalidate()
        setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0))
      }

      if (event.code === 'ArrowDown') {
        useGlobalStore.getState().systemSfxController.play(1, 0, 127, 128)
        invalidate()
        setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, options.length - 1))
      }
    }

    if (!isCloseableFocus) {
      return
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    currentIndex,
    id,
    isCloseable,
    isCloseableFocus,
    isSavePoint,
    options,
    worldScene,
    text,
    askOptions,
    hasDisplayedAllText,
  ])

  const {
    height: heightWithoutScaling,
    placements,
    selectedY,
    width: widthWithoutScaling,
  } = useMemo(() => {
    const result = processTextLayout(formattedText, options, currentIndex, message)
    invalidate()
    return result
  }, [currentIndex, formattedText, message, options])

  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(textCanvas)
    canvasTexture.wrapS = ClampToEdgeWrapping
    canvasTexture.wrapT = ClampToEdgeWrapping
    canvasTexture.needsUpdate = true
    return canvasTexture
  }, [textCanvas])

  const messageStyle = useGlobalStore((state) => state.messageStyles[message.placement.channel ?? 0]) ?? {
    color: 4096,
    mode: 0,
  }

  const messageSpeed = useGlobalStore((state) => state.messageSpeeds[message.placement.channel ?? 0]) ?? FONT_SPEED_UNIT
  const glyphsPerSecond =
    messageSpeed === 0 ? Number.MAX_SAFE_INTEGER : (messageSpeed / FONT_SPEED_UNIT) * TARGET_FPS * SPEED_MULTIPLIER

  const scaleRef = useRef(0)
  const textProgressRef = useRef(0)
  const hasDisplayedAllTextRef = useRef(false)
  const pauseStartRef = useRef<number | undefined>(undefined)
  const pauseIndexRef = useRef(0)

  useEffect(() => {
    return () => {
      scaleRef.current = 0
      textProgressRef.current = 0
      pauseStartRef.current = undefined
      pauseIndexRef.current = 0
      hasDisplayedAllTextRef.current = false
      texture.needsUpdate = true
      invalidate()
    }
  }, [formattedText, currentPage, texture])

  const drawMessageBox = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      xPos: number,
      yPos: number,
      width: number,
      height: number,
      scale: number,
      delta: number,
    ) => {
      textCanvas.width = SCREEN_WIDTH * 2
      textCanvas.height = SCREEN_HEIGHT * 2
      ctx.imageSmoothingEnabled = false

      drawGradientBackground(ctx, xPos, yPos, width, height, messageStyle.mode)
      drawBorders(ctx, xPos, yPos, width, height)

      return updateScale(scale, delta, OPEN_SPEED)
    },
    [messageStyle.mode, textCanvas],
  )

  const handleWait = useCallback((placement: Extract<Modifier, { type: 'wait' }>, placementIndex: number) => {
    const pausedAtTime = pauseStartRef.current

    if (pauseIndexRef.current > placementIndex) {
      return false
    }
    if (placementIndex > textProgressRef.current && !hasDisplayedAllTextRef.current) {
      return false
    }

    if (pausedAtTime && Date.now() - pausedAtTime < framesToMs(placement.duration)) {
      return true
    }

    if (!pausedAtTime) {
      pauseStartRef.current = Date.now()
      pauseIndexRef.current = placementIndex
      textProgressRef.current = placementIndex
      return true
    }

    pauseStartRef.current = undefined
    pauseIndexRef.current = placementIndex + 1
    return false
  }, [])

  const drawAnimatedText = useCallback(
    (ctx: CanvasRenderingContext2D, xPos: number, yPos: number, delta: number) => {
      let currentColor: FontColor = 'white'
      let isBlinkingOff = false
      let isPaused = false
      let displayedCount = 0

      placements.forEach((placement, index) => {
        if (isPaused) {
          return
        }
        if (index > textProgressRef.current && !hasDisplayedAllTextRef.current) {
          return
        }

        if ('type' in placement && placement.type === 'color' && placement.color) {
          currentColor = placement.color
          isBlinkingOff = !!(placement.isBlinking && isBlinkOff(textProgressRef.current, BLINK_DELAY))
          if (placement.isBlinking) {
            invalidate()
          }
          displayedCount++
          return
        }

        if ('type' in placement && placement.type === 'wait') {
          isPaused = handleWait(placement, index)
          displayedCount++
          return
        }

        const alpha = isBlinkingOff ? 0 : 1
        drawCharacter(
          ctx,
          fontTextures[currentColor].image,
          placement as Placement,
          xPos,
          yPos,
          messageStyle.color / 4096,
          alpha,
        )
        displayedCount++
      })

      if (displayedCount === placements.length) {
        hasDisplayedAllTextRef.current = true
        setHasDisplayedAllText(true)
      }

      textProgressRef.current += delta * glyphsPerSecond
      return hasDisplayedAllTextRef.current
    },
    [fontTextures, glyphsPerSecond, handleWait, messageStyle.color, placements],
  )

  const drawCursor = useCallback(
    (ctx: CanvasRenderingContext2D, xPos: number, yPos: number) => {
      const cursorImageRatio = 15 / 24
      const imageHeight = OUTPUT_TILE_HEIGHT * cursorImageRatio
      ctx.drawImage(
        cursor.image,
        xPos + LEFT_MARGIN,
        yPos + selectedY + (OUTPUT_TILE_HEIGHT - imageHeight) / 2,
        OUTPUT_TILE_WIDTH,
        imageHeight,
      )
    },
    [cursor.image, selectedY],
  )

  useFrame(({ invalidate }, delta) => {
    const ctx = textCanvas.getContext('2d')
    if (!ctx) {
      return
    }

    const currentScale = scaleRef.current
    const placement = calculateSafePlacement(
      message,
      widthWithoutScaling / 2,
      heightWithoutScaling / 2,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    )
    const xPosWithoutScaling = placement.x * 2
    const yPosWithoutScaling = Math.max(0, placement.y * 2)

    const { height, width, xOffset, yOffset } = calculateScaledDimensions(
      widthWithoutScaling,
      heightWithoutScaling,
      currentScale,
    )

    const xPos = xPosWithoutScaling + xOffset
    const yPos = yPosWithoutScaling + yOffset

    const nextScale = drawMessageBox(ctx, xPos, yPos, width, height, currentScale, delta)

    if (nextScale < 1) {
      scaleRef.current = nextScale
      texture.needsUpdate = true
      invalidate()
      return
    }

    const hasDisplayedAllText = drawAnimatedText(ctx, xPos, yPos, delta)
    texture.needsUpdate = true

    if (!hasDisplayedAllText) {
      invalidate()
      return
    }

    if (options) {
      drawCursor(ctx, xPos, yPos)
    }
  })

  return (
    <Plane args={[SCREEN_WIDTH, SCREEN_HEIGHT, 1]} position={[SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, -1]}>
      <meshBasicMaterial map={texture} transparent />
    </Plane>
  )
}

export default MessageBox
