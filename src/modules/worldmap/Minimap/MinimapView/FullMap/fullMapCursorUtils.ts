import { WORLDMAP_PAD_BITS } from '../../../../../constants/controls'
import { FULL_MAP_CURSOR_STEP, FULL_MAP_SNAP_DISTANCE } from '../../constants'
import { MapCell, wrapMapCell } from '../../minimapUtils'
import { getMapCellOfPixel, getMapPixelOfCell, MapPixel } from './fullMapUtils'

const getAxisStep = (padButtons: number, negativeBit: number, positiveBit: number) => {
  if (padButtons & positiveBit) {
    return FULL_MAP_CURSOR_STEP
  }
  return padButtons & negativeBit ? -FULL_MAP_CURSOR_STEP : 0
}

const isNearCursor = (marker: MapPixel, cursor: MapCell) => {
  const cursorPixel = getMapPixelOfCell(cursor)
  return (
    Math.abs(marker.x - cursorPixel.x) < FULL_MAP_SNAP_DISTANCE &&
    Math.abs(marker.y - cursorPixel.y) < FULL_MAP_SNAP_DISTANCE
  )
}

const snapCursorToMarker = (cursor: MapCell, markers: readonly MapPixel[]) => {
  const marker = markers.find((candidate) => isNearCursor(candidate, cursor))
  return marker ? getMapCellOfPixel(marker) : cursor
}

export const advanceCursor = (cursor: MapCell, padButtons: number, markers: readonly MapPixel[]) => {
  const stepX = getAxisStep(padButtons, WORLDMAP_PAD_BITS.left, WORLDMAP_PAD_BITS.right)
  const stepY = getAxisStep(padButtons, WORLDMAP_PAD_BITS.forward, WORLDMAP_PAD_BITS.backward)
  if (stepX === 0 && stepY === 0) {
    return snapCursorToMarker(cursor, markers)
  }
  return wrapMapCell({ cellX: cursor.cellX + stepX, cellY: cursor.cellY + stepY })
}
