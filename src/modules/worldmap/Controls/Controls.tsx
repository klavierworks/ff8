import { useCallback } from 'react'
import { shallow } from 'zustand/shallow'

import { WORLDMAP_CONTROLS_MAP } from '../../../constants/controls'
import { getNextMinimapMode } from '../Minimap/minimapUtils'
import { placeDebugRagnarokBesidePlayer } from '../Player/FlyingRagnarok/debugRagnarok'
import useWorldmapStore from '../worldmapStore'
import { getControlsState, WATCHED_KEY_CODES } from './controlsUtils'
import useHeldKeys from './useHeldKeys'

const handleKeyPress = (code: string) => {
  if (code === WORLDMAP_CONTROLS_MAP.debugPlaceRagnarok) {
    placeDebugRagnarokBesidePlayer()
    return
  }
  if (code === WORLDMAP_CONTROLS_MAP.toggleMinimap) {
    useWorldmapStore.setState((state) => ({
      minimapMode: getNextMinimapMode(state.minimapMode, state.worldMapState),
    }))
  }
}

const Controls = () => {
  const handleChange = useCallback((heldKeys: ReadonlySet<string>, pressedCode: null | string) => {
    if (pressedCode !== null) {
      handleKeyPress(pressedCode)
    }
    const next = getControlsState(heldKeys)
    useWorldmapStore.setState((state) => (shallow(state.controls, next) ? state : { controls: next }))
  }, [])

  useHeldKeys({ onChange: handleChange, watchedCodes: WATCHED_KEY_CODES })

  return null
}

export default Controls
