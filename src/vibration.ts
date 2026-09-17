export type VibrationPatternTable = 'field' | 'worldmap'

type IsVibrationPlaying = (handle: number) => boolean

type StartVibration = (table: VibrationPatternTable, patternIndex: number, priority: number) => number

export const VIBRATION_NOT_STARTED = 0

export const startVibration: StartVibration = () => VIBRATION_NOT_STARTED

export const isVibrationPlaying: IsVibrationPlaying = () => false
