import { CardElement } from '../../constants/cardGame'

export type BoardCell = {
  element: CardElement | null
  placed: null | PlacedCard
}

export type CardGameConfig = {
  backgroundPalette: number
  opponentCardIds: number[]
  opponentName: string
  opponentStrength: number
  rules: CardGameRules
}

export type CardGameRules = {
  isElemental: boolean
  isOpen: boolean
  isPlus: boolean
  isSame: boolean
  isSameWall: boolean
  isSuddenDeath: boolean
  tradeRule: number
}

export type CardGameSelection = {
  boardCursor: number
  handCursor: number
  mode: SelectionMode
}

export type CardOwner = 'opponent' | 'player'

export type GamePhase = 'intro' | 'play' | 'result'

export type GameResult = 'draw' | 'loss' | 'win'

export type GameState = {
  board: BoardCell[]
  firstPlayer: CardOwner
  opponentHand: HandCard[]
  phase: GamePhase
  playerHand: HandCard[]
  result: GameResult | null
  rules: CardGameRules
  turn: CardOwner
}

export type HandCard = {
  definitionId: number
  isPlayed: boolean
  owner: CardOwner
}

export type PlacedCard = {
  capturedSides: Side[]
  definitionId: number
  owner: CardOwner
}

export type SelectionMode = 'selectingCard' | 'selectingCell'

export type Side = 'bottom' | 'left' | 'right' | 'top'
