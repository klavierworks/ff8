import { create } from 'zustand'

import { TRADE_ONE } from '../../constants/cardGame'
import useGlobalStore from '../../store'
import { chooseOpponentMove } from './ai'
import { applyTradeToCollection, getTotalOwnedCards, selectPlayerHand } from './collection'
import { createInitialState, finalizeGame, isBoardFull, placeCard, TradeOutcome } from './logic'
import {
  moveBoardCursor as computeBoardCursor,
  moveHandCursor as computeHandCursor,
  getFirstEmptyCell,
  getNextPlayerSelection,
  INITIAL_SELECTION,
} from './transitions'
import { CardGameConfig, CardGameSelection, GameResult, GameState } from './types'

type CardGameLaunchParams = {
  backgroundPalette: number
  opponentLevel: number
}

type CardGameOutcome = {
  ownedCardCount: number
  resultCode: number
}

type CardGameSession = {
  selection: CardGameSelection | null
  state: GameState | null
  tradeOutcome: null | TradeOutcome
}

const MINIMUM_OWNED_CARDS = 5

// SCRIPT_CARDGAME return code (see ida.md "Triple Triad").
const RESULT_CODE: Record<GameResult, number> = { draw: 1, loss: 0, win: 2 }

const SFX_MOVE = 1
const SFX_CONFIRM = 1
const SFX_CANCEL = 9
const SFX_BLOCKED = 16

const playSfx = (id: number) => useGlobalStore.getState().systemSfxController.play(id, 0, 127, 128)

// Masks the raw opcode bytes (palette = low 3 bits, level = low 4 bits) and defaults to the
// early-game ruleset.
const buildConfig = ({ backgroundPalette, opponentLevel }: CardGameLaunchParams): CardGameConfig => ({
  backgroundPalette: backgroundPalette & 0x07,
  opponentCardIds: [],
  opponentName: 'Card Player',
  opponentStrength: Math.min(116, Math.max(18, 20 + (opponentLevel & 0x0f) * 10)),
  rules: {
    isElemental: false,
    isOpen: false,
    isPlus: false,
    isSame: false,
    isSameWall: false,
    isSuddenDeath: false,
    tradeRule: TRADE_ONE,
  },
})

const createCardGameController = () => {
  const store = create<CardGameSession>(() => ({ selection: null, state: null, tradeOutcome: null }))
  const { getState, setState } = store

  let resolveResult: ((code: number) => void) | undefined
  let hasFinalized = false

  // When the last card fills the board, finalize in the same update that placed it so the result
  // screen never flashes the live game for a frame. The trade is settled exactly once.
  const commit = (next: GameState) => {
    if (isBoardFull(next)) {
      const finished = finalizeGame(next)
      let { tradeOutcome } = getState()
      if (!hasFinalized) {
        hasFinalized = true
        tradeOutcome = applyTradeToCollection(finished, finished.result ?? 'draw')
      }
      setState({ state: finished, tradeOutcome })
      return
    }
    setState({ selection: getNextPlayerSelection(next), state: next })
  }

  // Slot 0 returns the player's card count (the script's "need 5 cards" gate reads this, NOT the
  // result) and slot 1 the win/loss/draw code — see ida.md "Triple Triad". With fewer than the
  // minimum cards the game never starts, so the count alone tells the script to show the message.
  const start = (launch: CardGameLaunchParams): Promise<CardGameOutcome> => {
    const ownedCardCount = getTotalOwnedCards()
    if (ownedCardCount < MINIMUM_OWNED_CARDS) {
      return Promise.resolve({ ownedCardCount, resultCode: RESULT_CODE.loss })
    }
    const config = buildConfig(launch)
    const playerHand = selectPlayerHand(useGlobalStore.getState().ownedCards)
    hasFinalized = false
    setState({ selection: INITIAL_SELECTION, state: createInitialState(config, playerHand), tradeOutcome: null })
    useGlobalStore.setState({ isCardGameActive: true, isUserControllable: false })
    return new Promise<CardGameOutcome>((resolve) => {
      resolveResult = (resultCode) => resolve({ ownedCardCount, resultCode })
    })
  }

  const close = (result: GameResult) => {
    useGlobalStore.setState({ isCardGameActive: false, isUserControllable: true })
    setState({ selection: null, state: null, tradeOutcome: null })
    resolveResult?.(RESULT_CODE[result])
    resolveResult = undefined
  }

  const startPlay = () => {
    const { state } = getState()
    if (!state || state.phase !== 'intro') {
      return
    }
    setState({ state: { ...state, phase: 'play' } })
  }

  const placeForPlayer = () => {
    const { selection, state } = getState()
    if (!state || !selection) {
      return
    }
    if (state.board[selection.boardCursor].placed) {
      playSfx(SFX_BLOCKED)
      return
    }
    playSfx(SFX_CONFIRM)
    const { state: next } = placeCard(state, 'player', selection.handCursor, selection.boardCursor)
    commit(next)
  }

  const runOpponentMove = () => {
    const { state } = getState()
    if (!state || state.phase !== 'play' || state.turn !== 'opponent' || isBoardFull(state)) {
      return
    }
    const move = chooseOpponentMove(state)
    if (!move) {
      return
    }
    playSfx(SFX_CONFIRM)
    const { state: next } = placeCard(state, 'opponent', move.handIndex, move.cellIndex)
    commit(next)
  }

  const moveHandCursor = (direction: number) => {
    const { selection, state } = getState()
    if (!state || !selection) {
      return
    }
    playSfx(SFX_MOVE)
    setState({ selection: { ...selection, handCursor: computeHandCursor(state, selection.handCursor, direction) } })
  }

  const moveBoardCursor = (deltaRow: number, deltaColumn: number) => {
    const { selection } = getState()
    if (!selection) {
      return
    }
    playSfx(SFX_MOVE)
    setState({
      selection: { ...selection, boardCursor: computeBoardCursor(selection.boardCursor, deltaRow, deltaColumn) },
    })
  }

  const enterCellSelection = () => {
    const { selection, state } = getState()
    if (!state || !selection) {
      return
    }
    playSfx(SFX_CONFIRM)
    setState({ selection: { ...selection, boardCursor: getFirstEmptyCell(state), mode: 'selectingCell' } })
  }

  const cancelCellSelection = () => {
    const { selection } = getState()
    if (!selection) {
      return
    }
    playSfx(SFX_CANCEL)
    setState({ selection: { ...selection, mode: 'selectingCard' } })
  }

  return {
    cancelCellSelection,
    close,
    enterCellSelection,
    moveBoardCursor,
    moveHandCursor,
    placeForPlayer,
    runOpponentMove,
    start,
    startPlay,
    store,
  }
}

export const cardGameController = createCardGameController()

export const useCardGameStore = cardGameController.store
