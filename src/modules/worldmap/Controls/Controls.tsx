import { useCallback, useEffect } from 'react'
import { shallow } from 'zustand/shallow'

import { WORLDMAP_CONTROLS_MAP } from '../../../constants/controls'
import { calculateMinimapToggle } from '../Minimap/minimapUtils'
import { placeDebugRagnarokBesidePlayer } from '../Player/FlyingRagnarok/debugRagnarok'
import useWorldmapStore from '../worldmapStore'
import { getControlsState, getPadButtonsForCode, WATCHED_KEY_CODES } from './controlsUtils'
import { recordPadPress, resetPadPresses } from './padPresses'
import useHeldKeys from './useHeldKeys'

const handleKeyPress = (code: string) => {
  console.log('[dismount-debug] key press', code, 'pad bits', getPadButtonsForCode(code).toString(16))
  recordPadPress(getPadButtonsForCode(code))
  if (code === WORLDMAP_CONTROLS_MAP.debugPlaceRagnarok) {
    placeDebugRagnarokBesidePlayer()
    return
  }
  if (code === WORLDMAP_CONTROLS_MAP.toggleMinimap) {
    useWorldmapStore.setState(calculateMinimapToggle)
  }
}

const Controls = () => {
  useEffect(resetPadPresses, [])

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
