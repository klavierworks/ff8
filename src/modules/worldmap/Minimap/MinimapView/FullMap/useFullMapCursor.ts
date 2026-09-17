import { useRef } from 'react'

import useGlobalStore from '../../../../../store'
import useScriptTick from '../../../useScriptTick'
import useWorldmapStore from '../../../worldmapStore'
import { getMapCellFromWorld, MapCell } from '../../minimapUtils'
import { advanceCursor } from './fullMapCursorUtils'
import { MapPixel } from './fullMapUtils'

const getInitialCursor = (): MapCell => {
  const position = useGlobalStore.getState().characterPosition
  return position ? getMapCellFromWorld(position.x, position.z) : { cellX: 0, cellY: 0 }
}

const useFullMapCursor = (destinations: readonly MapPixel[]) => {
  const cursorRef = useRef<MapCell>(getInitialCursor())

  useScriptTick(
    () => {
      const { padButtons } = useWorldmapStore.getState().controls
      cursorRef.current = advanceCursor(cursorRef.current, padButtons, destinations)
    },
    { shouldSkipMountTick: true },
  )

  return cursorRef
}

export default useFullMapCursor
