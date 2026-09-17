import { CONE_CORNERS, NEEDLE_CORNERS, NEUTRAL_VERTEX_TINT, POINTER_TEXEL_SPAN } from '../../constants'
import { getMapCellFromWorld } from '../../minimapUtils'
import { createPsxQuadGeometry, createRect } from '../psxPrimitives'

export type PointerPlacement = {
  cellScale: number
  originX: number
  originY: number
}

const POINTER_TEXELS = createRect(0, 0, POINTER_TEXEL_SPAN, POINTER_TEXEL_SPAN)

export const createNeedleGeometry = () => createPsxQuadGeometry(NEEDLE_CORNERS, POINTER_TEXELS)

export const createConeGeometry = () => createPsxQuadGeometry(CONE_CORNERS, POINTER_TEXELS)

export const calculatePulseModulation = (pulse: number) => pulse / NEUTRAL_VERTEX_TINT

export const calculatePointerScreenPosition = (
  { cellScale, originX, originY }: PointerPlacement,
  worldX: number,
  worldZ: number,
) => {
  const { cellX, cellY } = getMapCellFromWorld(worldX, worldZ)
  return { x: originX + cellScale * cellX, y: originY + cellScale * cellY }
}
