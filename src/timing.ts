export const TARGET_FPS = 30

export const MS_PER_FRAME = 1000 / TARGET_FPS

export const framesToMs = (frames: number): number => frames * MS_PER_FRAME

export const msToFrames = (ms: number): number => ms / MS_PER_FRAME

export const framesToSeconds = (frames: number): number => frames / TARGET_FPS

export const secondsToFrames = (seconds: number): number => seconds * TARGET_FPS
