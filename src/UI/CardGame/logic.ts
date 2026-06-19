import {
  CARD_COUNT,
  CARD_DEFINITIONS,
  CardElement,
  HAND_SIZE,
  PLAYABLE_ELEMENTS,
  TRADE_ALL,
  TRADE_DIFF,
  TRADE_DIRECT,
  TRADE_ONE,
} from '../../constants/cardGame'
import { applyPlacement, assignBoardElements } from './captureRules'
import { CardGameConfig, CardOwner, GameResult, GameState, HandCard } from './types'

const ELEMENTAL_CELL_CHANCE = 0.3

const rollBoardElement = (): CardElement | null => {
  if (Math.random() >= ELEMENTAL_CELL_CHANCE) {
    return null
  }
  return PLAYABLE_ELEMENTS[Math.floor(Math.random() * PLAYABLE_ELEMENTS.length)]
}

const buildHand = (cardIds: number[], owner: CardOwner): HandCard[] =>
  cardIds.slice(0, HAND_SIZE).map((definitionId) => ({ definitionId, isPlayed: false, owner }))

export const generateOpponentHand = (strength: number): number[] => {
  const candidates = CARD_DEFINITIONS.map((card) => ({
    distance: Math.abs(card.aiValue - strength),
    id: card.id,
  })).sort((a, b) => a.distance - b.distance)

  const pool = candidates.slice(0, Math.min(candidates.length, 24)).map((entry) => entry.id)
  const picked: number[] = []
  while (picked.length < HAND_SIZE && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }
  while (picked.length < HAND_SIZE) {
    picked.push(Math.floor(Math.random() * CARD_COUNT))
  }
  return picked
}

export const createInitialState = (config: CardGameConfig, playerCardIds: number[]): GameState => {
  const firstPlayer: CardOwner = Math.random() < 0.5 ? 'player' : 'opponent'
  const opponentCardIds =
    config.opponentCardIds.length >= HAND_SIZE ? config.opponentCardIds : generateOpponentHand(config.opponentStrength)

  return {
    board: assignBoardElements(config.rules, rollBoardElement),
    firstPlayer,
    opponentHand: buildHand(opponentCardIds, 'opponent'),
    phase: 'intro',
    playerHand: buildHand(playerCardIds, 'player'),
    result: null,
    rules: config.rules,
    turn: firstPlayer,
  }
}

export const isBoardFull = (state: GameState) => state.board.every((cell) => cell.placed !== null)

const markHandCardPlayed = (hand: HandCard[], handIndex: number) =>
  hand.map((card, index) => (index === handIndex ? { ...card, isPlayed: true } : card))

export type PlaceCardResult = {
  capturedIndices: number[]
  state: GameState
}

export const placeCard = (
  state: GameState,
  owner: CardOwner,
  handIndex: number,
  cellIndex: number,
): PlaceCardResult => {
  const hand = owner === 'player' ? state.playerHand : state.opponentHand
  const card = hand[handIndex]
  const outcome = applyPlacement(
    state.board,
    cellIndex,
    { capturedSides: [], definitionId: card.definitionId, owner },
    state.rules,
  )
  const updatedHand = markHandCardPlayed(hand, handIndex)

  return {
    capturedIndices: outcome.capturedIndices,
    state: {
      ...state,
      board: outcome.board,
      opponentHand: owner === 'opponent' ? updatedHand : state.opponentHand,
      playerHand: owner === 'player' ? updatedHand : state.playerHand,
      turn: owner === 'player' ? 'opponent' : 'player',
    },
  }
}

export const finalizeGame = (state: GameState): GameState => ({
  ...state,
  phase: 'result',
  result: determineResult(state),
})

export const countUnplayed = (hand: HandCard[]) => hand.filter((card) => !card.isPlayed).length

export const calculateScores = (state: GameState) => {
  const boardPlayerCards = state.board.filter((cell) => cell.placed?.owner === 'player').length
  const boardOpponentCards = state.board.filter((cell) => cell.placed?.owner === 'opponent').length

  return {
    opponent: boardOpponentCards + countUnplayed(state.opponentHand),
    player: boardPlayerCards + countUnplayed(state.playerHand),
  }
}

export const determineResult = (state: GameState): GameResult => {
  const { opponent, player } = calculateScores(state)
  if (player > opponent) {
    return 'win'
  }
  if (player < opponent) {
    return 'loss'
  }
  return 'draw'
}

export type TradeOutcome = {
  cardsGainedByPlayer: number[]
  cardsLostByPlayer: number[]
}

const sortByAiValueDescending = (cardIds: number[]) =>
  [...cardIds].sort((a, b) => CARD_DEFINITIONS[b].aiValue - CARD_DEFINITIONS[a].aiValue)

const getOriginalCardIds = (hand: HandCard[]) => hand.map((card) => card.definitionId)

const getBoardCardIdsOwnedBy = (state: GameState, owner: CardOwner) =>
  state.board.flatMap((cell) => (cell.placed?.owner === owner ? [cell.placed.definitionId] : []))

export const resolveTrade = (state: GameState, result: GameResult): TradeOutcome => {
  const { tradeRule } = state.rules
  const opponentCardIds = getOriginalCardIds(state.opponentHand)
  const playerCardIds = getOriginalCardIds(state.playerHand)

  if (result === 'draw') {
    return { cardsGainedByPlayer: [], cardsLostByPlayer: [] }
  }

  if (tradeRule === TRADE_DIRECT) {
    return {
      cardsGainedByPlayer: getBoardCardIdsOwnedBy(state, 'player').filter((id) => opponentCardIds.includes(id)),
      cardsLostByPlayer: getBoardCardIdsOwnedBy(state, 'opponent').filter((id) => playerCardIds.includes(id)),
    }
  }

  if (tradeRule === TRADE_ALL) {
    return result === 'win'
      ? { cardsGainedByPlayer: opponentCardIds, cardsLostByPlayer: [] }
      : { cardsGainedByPlayer: [], cardsLostByPlayer: playerCardIds }
  }

  const tradeCount = getTradeCount(state, tradeRule, result)
  if (result === 'win') {
    return { cardsGainedByPlayer: sortByAiValueDescending(opponentCardIds).slice(0, tradeCount), cardsLostByPlayer: [] }
  }
  return { cardsGainedByPlayer: [], cardsLostByPlayer: sortByAiValueDescending(playerCardIds).slice(0, tradeCount) }
}

const getTradeCount = (state: GameState, tradeRule: number, result: GameResult): number => {
  if (tradeRule === TRADE_ONE) {
    return 1
  }
  if (tradeRule === TRADE_DIFF) {
    const { opponent, player } = calculateScores(state)
    const difference = Math.abs(player - opponent)
    return Math.max(1, Math.min(HAND_SIZE, difference))
  }
  return result === 'win' ? 1 : 0
}
