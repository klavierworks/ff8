import { useEffect } from 'react'

import { RESULT_BANNER_MS } from '../../constants/cardGameLayout'
import { closeMessage, openMessage } from '../../modules/field/Scripts/Script/utils'
import { cardGameController, useCardGameStore } from './CardGameController'
import { calculateScores } from './logic'
import {
  buildRulesAskOptions,
  buildRulesText,
  buildTradeBoxes,
  QUIT_OPTION_INDEX,
  RULES_MESSAGE_ID,
  RULES_PLACEMENT,
  STATUS_PLACEMENT,
  TRADE_MESSAGE_ID,
} from './messages'
import useInput from './useInput'

const OPPONENT_MOVE_DELAY_MS = 750
const EMPTY_SCORES = { opponent: 0, player: 0 }

const useGame = () => {
  const state = useCardGameStore((session) => session.state)
  const selection = useCardGameStore((session) => session.selection)
  const tradeOutcome = useCardGameStore((session) => session.tradeOutcome)

  const phase = state?.phase
  const turn = state?.turn

  useInput()

  // Quit aborts as a no-contest 'draw' (the port has no quit result). No has-run guard: it would
  // survive a StrictMode remount and suppress the surviving effect's resolver registration.
  useEffect(() => {
    if (phase !== 'intro') {
      return
    }
    const current = cardGameController.store.getState().state
    if (!current) {
      return
    }
    let isCancelled = false
    openMessage(
      RULES_MESSAGE_ID,
      [buildRulesText(current.rules)],
      RULES_PLACEMENT,
      true,
      buildRulesAskOptions(current.rules),
    ).then((selectedOption) => {
      if (isCancelled) {
        return
      }
      if (selectedOption === QUIT_OPTION_INDEX) {
        cardGameController.close('draw')
        return
      }
      cardGameController.startPlay()
    })
    return () => {
      isCancelled = true
      closeMessage(RULES_MESSAGE_ID)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'play' || turn !== 'opponent') {
      return
    }
    const timeout = setTimeout(() => cardGameController.runOpponentMove(), OPPONENT_MOVE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [phase, turn])

  useEffect(() => {
    if (phase !== 'result' || !tradeOutcome) {
      return
    }
    const current = cardGameController.store.getState().state
    if (!current || !current.result) {
      return
    }
    const finalResult = current.result
    let isCancelled = false
    const showResultSequence = async () => {
      await new Promise((resolve) => setTimeout(resolve, RESULT_BANNER_MS))
      const tradeBoxes = buildTradeBoxes(tradeOutcome)
      for (let index = 0; index < tradeBoxes.length; index++) {
        if (isCancelled) {
          return
        }
        await openMessage(`${TRADE_MESSAGE_ID}-${index}`, [tradeBoxes[index]], STATUS_PLACEMENT, true)
      }
      if (!isCancelled) {
        cardGameController.close(finalResult)
      }
    }
    showResultSequence()
    return () => {
      isCancelled = true
      buildTradeBoxes(tradeOutcome).forEach((_, index) => closeMessage(`${TRADE_MESSAGE_ID}-${index}`))
    }
  }, [phase, tradeOutcome])

  return { scores: state ? calculateScores(state) : EMPTY_SCORES, selection, state }
}

export default useGame
