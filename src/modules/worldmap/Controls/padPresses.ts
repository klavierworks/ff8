type PadPresses = {
  latchedPresses: number
  latchedTick: number
  pendingPresses: number
}

const INITIAL_PRESSES: PadPresses = { latchedPresses: 0, latchedTick: -1, pendingPresses: 0 }

let presses = INITIAL_PRESSES

export const recordPadPress = (buttons: number) => {
  presses = { ...presses, pendingPresses: presses.pendingPresses | buttons }
}

// Every reader in the same tick sees the same presses; the first read of a new tick takes
// everything pressed since the previous one, so taps shorter than a tick still count.
export const getPadPresses = (tick: number) => {
  if (tick !== presses.latchedTick) {
    presses = { latchedPresses: presses.pendingPresses, latchedTick: tick, pendingPresses: 0 }
  }
  return presses.latchedPresses
}

export const resetPadPresses = () => {
  presses = INITIAL_PRESSES
}
