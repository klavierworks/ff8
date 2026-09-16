import LerpValue, { LoopMode } from '../../LerpValue'
import { framesToMs } from '../../timing'

export type BackgroundAnimation = {
  first: number
  last: number
  progress: LerpValue
}

const getStateCount = ({ first, last }: Pick<BackgroundAnimation, 'first' | 'last'>) => Math.abs(last - first) + 1

export const createBackgroundDraw = (state: number): BackgroundAnimation => ({
  first: state,
  last: state,
  progress: new LerpValue(0),
})

// BGANIMESPEED is frames per state, and an unset speed of 0 still advances every frame.
export const startBackgroundAnimation = (first: number, last: number, speed: number, loopMode: LoopMode) => {
  const stateCount = getStateCount({ first, last })
  const progress = new LerpValue(0)
  progress.start(stateCount, framesToMs(stateCount * Math.max(speed, 1)), 0, loopMode)
  return { first, last, progress }
}

export const getBackgroundAnimationState = (animation: BackgroundAnimation) => {
  const step = Math.min(Math.floor(animation.progress.get()), getStateCount(animation) - 1)
  return animation.last < animation.first ? animation.first - step : animation.first + step
}
