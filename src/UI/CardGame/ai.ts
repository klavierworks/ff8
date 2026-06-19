import { BOARD_SIZE, CARD_DEFINITIONS } from '../../constants/cardGame'
import { applyPlacement, getCardPower, NEIGHBOR_DELTAS, toIndex, toRowColumn } from './captureRules'
import { BoardCell, GameState, HandCard } from './types'

export type OpponentMove = {
  cellIndex: number
  handIndex: number
}

const getEmptyCellIndices = (board: BoardCell[]) => board.flatMap((cell, index) => (cell.placed ? [] : [index]))

const calculateExposure = (board: BoardCell[], definitionId: number, cellIndex: number): number => {
  const { column, row } = toRowColumn(cellIndex)
  return NEIGHBOR_DELTAS.reduce((exposure, { deltaColumn, deltaRow, side }) => {
    const neighborRow = row + deltaRow
    const neighborColumn = column + deltaColumn
    const isOffBoard =
      neighborRow < 0 || neighborRow >= BOARD_SIZE || neighborColumn < 0 || neighborColumn >= BOARD_SIZE
    if (isOffBoard) {
      return exposure
    }
    const neighborCell = board[toIndex(neighborRow, neighborColumn)]
    if (neighborCell.placed) {
      return exposure
    }
    return exposure + (10 - getCardPower(definitionId, side))
  }, 0)
}

type ScoredMove = OpponentMove & {
  captures: number
  exposure: number
  handAiValue: number
}

export const chooseOpponentMove = (state: GameState): null | OpponentMove => {
  const emptyCells = getEmptyCellIndices(state.board)
  const playableHand = state.opponentHand
    .map((card, handIndex) => ({ card, handIndex }))
    .filter(({ card }) => !card.isPlayed)

  if (emptyCells.length === 0 || playableHand.length === 0) {
    return null
  }

  const scoredMoves: ScoredMove[] = playableHand.flatMap(({ card, handIndex }) =>
    emptyCells.map((cellIndex) => {
      const outcome = applyPlacement(
        state.board,
        cellIndex,
        { capturedSides: [], definitionId: card.definitionId, owner: 'opponent' },
        state.rules,
      )
      return {
        captures: outcome.capturedIndices.length,
        cellIndex,
        exposure: calculateExposure(state.board, card.definitionId, cellIndex),
        handAiValue: CARD_DEFINITIONS[card.definitionId].aiValue,
        handIndex,
      }
    }),
  )

  const bestCaptureCount = Math.max(...scoredMoves.map((move) => move.captures))

  if (bestCaptureCount > 0) {
    return pickBestAggressiveMove(scoredMoves, bestCaptureCount)
  }

  return pickSafestMove(scoredMoves)
}

const pickBestAggressiveMove = (scoredMoves: ScoredMove[], bestCaptureCount: number): OpponentMove =>
  scoredMoves
    .filter((move) => move.captures === bestCaptureCount)
    .sort((a, b) => a.handAiValue - b.handAiValue || a.exposure - b.exposure)[0]

const pickSafestMove = (scoredMoves: ScoredMove[]): OpponentMove =>
  [...scoredMoves].sort((a, b) => a.exposure - b.exposure || a.handAiValue - b.handAiValue)[0]

export const hasPlayableCard = (hand: HandCard[]) => hand.some((card) => !card.isPlayed)
