import {
  SMALL_MAP_HEIGHT,
  SMALL_MAP_LEFT,
  SMALL_MAP_TOP,
  SMALL_MAP_WIDTH,
  WORLD_MAP_TEXTURE_HEIGHT,
  WORLD_MAP_TEXTURE_WIDTH,
} from '../../constants'
import { createPsxQuadGeometry, createRect } from '../psxPrimitives'

export const createSmallMapGeometry = () =>
  createPsxQuadGeometry(
    createRect(SMALL_MAP_LEFT, SMALL_MAP_TOP, SMALL_MAP_WIDTH, SMALL_MAP_HEIGHT),
    createRect(0, 0, WORLD_MAP_TEXTURE_WIDTH, WORLD_MAP_TEXTURE_HEIGHT),
  )
