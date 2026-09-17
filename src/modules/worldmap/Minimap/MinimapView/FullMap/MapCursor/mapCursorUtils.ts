import {
  FULL_MAP_CURSOR_HEIGHT,
  FULL_MAP_CURSOR_OFFSET_X,
  FULL_MAP_CURSOR_OFFSET_Y,
  FULL_MAP_CURSOR_WIDTH,
  FULL_MAP_LEFT,
  FULL_MAP_TOP,
} from '../../../constants'
import { MapCell } from '../../../minimapUtils'
import { createPsxQuadGeometry, createRect } from '../../psxPrimitives'
import { getMapPixelOfCell } from '../fullMapUtils'

export const createCursorGeometry = () => {
  const bounds = createRect(0, 0, FULL_MAP_CURSOR_WIDTH, FULL_MAP_CURSOR_HEIGHT)
  return createPsxQuadGeometry(bounds, bounds)
}

export const calculateCursorScreenPosition = (cursor: MapCell) => {
  const { x, y } = getMapPixelOfCell(cursor)
  return { x: FULL_MAP_LEFT + x + FULL_MAP_CURSOR_OFFSET_X, y: FULL_MAP_TOP + y + FULL_MAP_CURSOR_OFFSET_Y }
}
