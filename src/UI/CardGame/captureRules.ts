import { BOARD_SIZE, CARD_DEFINITIONS, CardElement, WALL_VALUE } from '../../constants/cardGame'
import { BoardCell, CardGameRules, CardOwner, PlacedCard, Side } from './types'

const OPPOSITE_SIDE: Record<Side, Side> = {
  bottom: 'top',
  left: 'right',
  right: 'left',
  top: 'bottom',
}

type NeighborDelta = {
  deltaColumn: number
  deltaRow: number
  side: Side
}

export const NEIGHBOR_DELTAS: NeighborDelta[] = [
  { deltaColumn: 0, deltaRow: -1, side: 'top' },
  { deltaColumn: 0, deltaRow: 1, side: 'bottom' },
  { deltaColumn: -1, deltaRow: 0, side: 'left' },
  { deltaColumn: 1, deltaRow: 0, side: 'right' },
]

export const toRowColumn = (index: number) => ({
  column: index % BOARD_SIZE,
  row: Math.floor(index / BOARD_SIZE),
})

export const toIndex = (row: number, column: number) => row * BOARD_SIZE + column

export const getCardPower = (definitionId: number, side: Side) => CARD_DEFINITIONS[definitionId][side]

export const getElementalAdjustment = (cell: BoardCell, definitionId: number): number => {
  if (!cell.element) {
    return 0
  }
  return CARD_DEFINITIONS[definitionId].element === cell.element ? 1 : -1
}

type Neighbor = {
  cell: BoardCell
  index: number
  side: Side
}

const getOccupiedNeighbors = (board: BoardCell[], index: number): Neighbor[] => {
  const { column, row } = toRowColumn(index)
  return NEIGHBOR_DELTAS.flatMap(({ deltaColumn, deltaRow, side }) => {
    const neighborRow = row + deltaRow
    const neighborColumn = column + deltaColumn
    if (neighborRow < 0 || neighborRow >= BOARD_SIZE || neighborColumn < 0 || neighborColumn >= BOARD_SIZE) {
      return []
    }
    const neighborIndex = toIndex(neighborRow, neighborColumn)
    const cell = board[neighborIndex]
    if (!cell.placed) {
      return []
    }
    return [{ cell, index: neighborIndex, side }]
  })
}

const cloneCell = (cell: BoardCell): BoardCell => ({
  element: cell.element,
  placed: cell.placed ? { ...cell.placed, capturedSides: [...cell.placed.capturedSides] } : null,
})

export const cloneBoard = (board: BoardCell[]): BoardCell[] => board.map(cloneCell)

// The capture helpers below operate in place on `_board`, a board owned by applyPlacement
// (always a fresh clone), so the leading underscore flags it as mutable working state.
const captureNeighbor = (_board: BoardCell[], neighbor: Neighbor, newOwner: CardOwner): null | number => {
  const placed = _board[neighbor.index].placed
  if (!placed || placed.owner === newOwner) {
    return null
  }
  placed.owner = newOwner
  placed.capturedSides = [...placed.capturedSides, OPPOSITE_SIDE[neighbor.side]]
  return neighbor.index
}

const resolveBasic = (_board: BoardCell[], index: number, isElemental: boolean): number[] => {
  const cell = _board[index]
  const placed = cell.placed
  if (!placed) {
    return []
  }
  const placedAdjustment = isElemental ? getElementalAdjustment(cell, placed.definitionId) : 0

  return getOccupiedNeighbors(_board, index).flatMap((neighbor) => {
    const neighborPlaced = neighbor.cell.placed
    if (!neighborPlaced || neighborPlaced.owner === placed.owner) {
      return []
    }
    const placedPower = getCardPower(placed.definitionId, neighbor.side) + placedAdjustment
    const neighborAdjustment = isElemental ? getElementalAdjustment(neighbor.cell, neighborPlaced.definitionId) : 0
    const neighborPower = getCardPower(neighborPlaced.definitionId, OPPOSITE_SIDE[neighbor.side]) + neighborAdjustment
    if (placedPower <= neighborPower) {
      return []
    }
    const capturedIndex = captureNeighbor(_board, neighbor, placed.owner)
    return capturedIndex !== null ? [capturedIndex] : []
  })
}

const resolveSame = (_board: BoardCell[], index: number, rules: CardGameRules): number[] => {
  const placed = _board[index].placed
  if (!placed) {
    return []
  }

  const { column, row } = toRowColumn(index)
  const { matchCount, matches } = NEIGHBOR_DELTAS.reduce<{ matchCount: number; matches: Neighbor[] }>(
    ({ matchCount, matches }, { deltaColumn, deltaRow, side }) => {
      const placedPower = getCardPower(placed.definitionId, side)
      const neighborRow = row + deltaRow
      const neighborColumn = column + deltaColumn
      const isOffBoard =
        neighborRow < 0 || neighborRow >= BOARD_SIZE || neighborColumn < 0 || neighborColumn >= BOARD_SIZE

      if (isOffBoard) {
        return rules.isSameWall && placedPower === WALL_VALUE
          ? { matchCount: matchCount + 1, matches }
          : { matchCount, matches }
      }

      const neighborIndex = toIndex(neighborRow, neighborColumn)
      const cell = _board[neighborIndex]
      if (!cell.placed || placedPower !== getCardPower(cell.placed.definitionId, OPPOSITE_SIDE[side])) {
        return { matchCount, matches }
      }
      return { matchCount: matchCount + 1, matches: [...matches, { cell, index: neighborIndex, side }] }
    },
    { matchCount: 0, matches: [] },
  )

  if (matchCount < 2) {
    return []
  }

  return matches.flatMap((neighbor) => {
    const capturedIndex = captureNeighbor(_board, neighbor, placed.owner)
    return capturedIndex !== null ? [capturedIndex] : []
  })
}

// Plus flips only the single sum-bucket with the most neighbours (ties → the first sum to reach
// that count in side order), not every bucket of size >= 2.
const resolvePlus = (_board: BoardCell[], index: number): number[] => {
  const placed = _board[index].placed
  if (!placed) {
    return []
  }

  const sumToNeighbors = new Map<number, Neighbor[]>()
  let bestSum: null | number = null
  let bestCount = 0

  getOccupiedNeighbors(_board, index).forEach((neighbor) => {
    const neighborPlaced = neighbor.cell.placed
    if (!neighborPlaced) {
      return
    }
    const sum =
      getCardPower(placed.definitionId, neighbor.side) +
      getCardPower(neighborPlaced.definitionId, OPPOSITE_SIDE[neighbor.side])
    const list = sumToNeighbors.get(sum) ?? []
    list.push(neighbor)
    sumToNeighbors.set(sum, list)
    if (list.length > bestCount) {
      bestCount = list.length
      bestSum = sum
    }
  })

  if (bestCount < 2 || bestSum === null) {
    return []
  }

  return (sumToNeighbors.get(bestSum) ?? []).flatMap((neighbor) => {
    const capturedIndex = captureNeighbor(_board, neighbor, placed.owner)
    return capturedIndex !== null ? [capturedIndex] : []
  })
}

const runCombo = (_board: BoardCell[], comboSources: number[], isElemental: boolean): number[] => {
  const captured: number[] = []
  const queue = [...comboSources]
  while (queue.length > 0) {
    const source = queue.shift() as number
    const newlyCaptured = resolveBasic(_board, source, isElemental)
    captured.push(...newlyCaptured)
    queue.push(...newlyCaptured)
  }
  return captured
}

export type PlacementOutcome = {
  board: BoardCell[]
  capturedIndices: number[]
}

export const applyPlacement = (
  board: BoardCell[],
  index: number,
  card: PlacedCard,
  rules: CardGameRules,
): PlacementOutcome => {
  const nextBoard = cloneBoard(board)
  nextBoard[index] = { ...nextBoard[index], placed: { ...card, capturedSides: [] } }

  const sameCaptures = rules.isSame ? resolveSame(nextBoard, index, rules) : []
  const plusCaptures = rules.isPlus ? resolvePlus(nextBoard, index) : []
  const basicCaptures = resolveBasic(nextBoard, index, rules.isElemental)

  // Combo triggers only when Same or Plus captured a card; once triggered, every card flipped this
  // turn — Same, Plus, and the placed card's basic captures — seeds a chained basic-capture pass.
  // A pure basic capture never chains.
  const directCaptures = [...sameCaptures, ...plusCaptures, ...basicCaptures]
  const hasTriggeredCombo = sameCaptures.length > 0 || plusCaptures.length > 0
  const comboCaptures = hasTriggeredCombo ? runCombo(nextBoard, directCaptures, rules.isElemental) : []

  return { board: nextBoard, capturedIndices: [...directCaptures, ...comboCaptures] }
}

export const assignBoardElements = (rules: CardGameRules, rollElement: () => CardElement | null): BoardCell[] => {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => ({
    element: rules.isElemental ? rollElement() : null,
    placed: null,
  }))
}
