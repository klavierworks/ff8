import { BOARD_SIZE } from '../../constants/cardGame'
import { toIndex, toRowColumn } from './captureRules'
import { CardGameSelection, GameState } from './types'

export const INITIAL_SELECTION: CardGameSelection = { boardCursor: 0, handCursor: 0, mode: 'selectingCard' }

export const getFirstEmptyCell = (state: GameState) => {
  const index = state.board.findIndex((cell) => !cell.placed)
  return Math.max(0, index)
}

const getPlayerUnplayedIndices = (state: GameState) =>
  state.playerHand.flatMap((card, index) => (card.isPlayed ? [] : [index]))

export const getFirstUnplayedHandIndex = (state: GameState) => {
  const unplayed = getPlayerUnplayedIndices(state)
  return unplayed.length > 0 ? unplayed[0] : 0
}

export const moveHandCursor = (state: GameState, current: number, direction: number) => {
  const unplayed = getPlayerUnplayedIndices(state)
  if (unplayed.length === 0) {
    return current
  }
  const position = Math.max(0, unplayed.indexOf(current))
  const nextPosition = (position + direction + unplayed.length) % unplayed.length
  return unplayed[nextPosition]
}

export const moveBoardCursor = (current: number, deltaRow: number, deltaColumn: number) => {
  const { column, row } = toRowColumn(current)
  const nextRow = Math.min(BOARD_SIZE - 1, Math.max(0, row + deltaRow))
  const nextColumn = Math.min(BOARD_SIZE - 1, Math.max(0, column + deltaColumn))
  return toIndex(nextRow, nextColumn)
}

export const getNextPlayerSelection = (state: GameState): CardGameSelection => ({
  boardCursor: getFirstEmptyCell(state),
  handCursor: getFirstUnplayedHandIndex(state),
  mode: 'selectingCard',
})
