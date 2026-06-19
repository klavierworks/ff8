import { CARD_DEFINITIONS, HAND_SIZE } from '../../constants/cardGame'
import useGlobalStore from '../../store'
import { resolveTrade } from './logic'
import { GameResult, GameState } from './types'

export const selectPlayerHand = (ownedCards: Record<number, number>): number[] => {
  const owned = Object.entries(ownedCards).flatMap(([id, count]) => Array.from({ length: count }, () => Number(id)))
  return owned.sort((a, b) => CARD_DEFINITIONS[b].aiValue - CARD_DEFINITIONS[a].aiValue).slice(0, HAND_SIZE)
}

export const getOwnedCardCount = (cardId: number) => useGlobalStore.getState().ownedCards[cardId] ?? 0

export const getTotalOwnedCards = () =>
  Object.values(useGlobalStore.getState().ownedCards).reduce((total, count) => total + count, 0)

export const addCardToCollection = (cardId: number, amount = 1) => {
  useGlobalStore.setState((state) => ({
    ownedCards: { ...state.ownedCards, [cardId]: (state.ownedCards[cardId] ?? 0) + amount },
  }))
}

export const removeCardFromCollection = (cardId: number) => {
  useGlobalStore.setState((state) => {
    const current = state.ownedCards[cardId] ?? 0
    if (current <= 0) {
      return state
    }
    const ownedCards = { ...state.ownedCards }
    if (current <= 1) {
      delete ownedCards[cardId]
    } else {
      ownedCards[cardId] = current - 1
    }
    return { ownedCards }
  })
}

export const applyTradeToCollection = (state: GameState, result: GameResult) => {
  const outcome = resolveTrade(state, result)
  outcome.cardsGainedByPlayer.forEach((cardId) => addCardToCollection(cardId))
  outcome.cardsLostByPlayer.forEach((cardId) => removeCardFromCollection(cardId))
  return outcome
}
