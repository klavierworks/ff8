export const TARGET_FPS = 30

export const MS_PER_FRAME = 1000 / TARGET_FPS

export const framesToMs = (frames: number): number => frames * MS_PER_FRAME

export const framesToSeconds = (frames: number): number => frames / TARGET_FPS

export const advanceProgress = (current: number, delta: number, durationFrames: number) =>
  Math.min(1, current + delta / framesToSeconds(durationFrames))

export const getDelayedProgress = (seconds: number, delayFrames: number, durationFrames: number) =>
  Math.min(1, Math.max(0, (seconds - framesToSeconds(delayFrames)) / framesToSeconds(durationFrames)))
