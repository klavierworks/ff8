import { useEffect } from 'react'

import { CONTROLS_MAP } from '../../constants/controls'
import useGlobalStore from '../../store'
import { cardGameController } from './CardGameController'

const handleSelectingCardKey = (event: KeyboardEvent) => {
  if (event.code === 'ArrowUp') {
    cardGameController.moveHandCursor(-1)
    return
  }
  if (event.code === 'ArrowDown') {
    cardGameController.moveHandCursor(1)
    return
  }
  if (event.code === CONTROLS_MAP.confirm) {
    cardGameController.enterCellSelection()
  }
}

const handleSelectingCellKey = (event: KeyboardEvent) => {
  if (event.code === CONTROLS_MAP.cancel) {
    cardGameController.cancelCellSelection()
    return
  }
  if (event.code === 'ArrowUp') {
    cardGameController.moveBoardCursor(-1, 0)
    return
  }
  if (event.code === 'ArrowDown') {
    cardGameController.moveBoardCursor(1, 0)
    return
  }
  if (event.code === 'ArrowLeft') {
    cardGameController.moveBoardCursor(0, -1)
    return
  }
  if (event.code === 'ArrowRight') {
    cardGameController.moveBoardCursor(0, 1)
    return
  }
  if (event.code === CONTROLS_MAP.confirm) {
    cardGameController.placeForPlayer()
  }
}

const useInput = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // While a dialog box is open it owns confirm/cancel — let it close itself first.
      if (useGlobalStore.getState().currentMessages.length > 0) {
        return
      }
      const { selection, state } = cardGameController.store.getState()
      if (!state || !selection || state.phase !== 'play' || state.turn !== 'player') {
        return
      }
      if (selection.mode === 'selectingCard') {
        handleSelectingCardKey(event)
        return
      }
      handleSelectingCellKey(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

export default useInput
