import { TARGET_FPS } from '../../timing'

const SECONDS_PER_FRAME = 1 / TARGET_FPS

// Advancing at most one frame per render frame keeps a script tick and a game
// frame the same unit. The engine's REQSW/PREQSW start latency is one frame,
// and scripts compensate for it with matching WAIT counts (the Esthar lifts
// stagger WAIT 3/2/1/0 across the lift and each rider so all four begin their
// offset on the same frame), so any clock that can skip frames desynchronises
// them. Below 30 FPS the script layer runs slow, as the original console did.
const MAX_ACCUMULATED_SECONDS = SECONDS_PER_FRAME * 2

type Waiter = {
  resolve: () => void
  targetFrame: number
}

let currentFrame = 0
let accumulatedSeconds = 0
let waiters: Waiter[] = []

export const getScriptFrame = () => currentFrame

const releaseDueWaiters = () => {
  const dueWaiters = waiters.filter((waiter) => waiter.targetFrame <= currentFrame)
  if (dueWaiters.length === 0) {
    return
  }
  waiters = waiters.filter((waiter) => waiter.targetFrame > currentFrame)
  dueWaiters.forEach((waiter) => waiter.resolve())
}

export const advanceScriptClock = (delta: number) => {
  accumulatedSeconds = Math.min(accumulatedSeconds + delta, MAX_ACCUMULATED_SECONDS)
  if (accumulatedSeconds < SECONDS_PER_FRAME) {
    return
  }
  accumulatedSeconds -= SECONDS_PER_FRAME
  currentFrame += 1
  releaseDueWaiters()
}

export const waitForScriptFrames = (frames: number) =>
  new Promise<void>((resolve) => {
    waiters = [...waiters, { resolve, targetFrame: currentFrame + Math.max(1, frames) }]
  })

export const nextScriptFrame = () => waitForScriptFrames(1)

export const releaseAllScriptWaiters = () => {
  const abandonedWaiters = waiters
  waiters = []
  accumulatedSeconds = 0
  abandonedWaiters.forEach((waiter) => waiter.resolve())
}
