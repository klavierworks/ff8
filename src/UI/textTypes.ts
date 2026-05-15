export type FontColor = 'blue' | 'gray' | 'green' | 'magenta' | 'red' | 'shadow' | 'white' | 'yellow'

export type Modifier =
  | {
      color?: FontColor
      isBlinking: boolean
      type: 'color'
    }
  | {
      duration: number
      type: 'wait'
    }
  | {
      type: 'unknownModifier'
    }

export type Placement = {
  columnIndex: number
  rowIndex: number
  x: number
  y: number
}
