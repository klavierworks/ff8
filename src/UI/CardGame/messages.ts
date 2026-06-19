import { CARD_DEFINITIONS } from '../../constants/cardGame'
import { getTradeRuleLabel, listActiveRules } from './display'
import { TradeOutcome } from './logic'
import { CardGameRules } from './types'

const SCREEN_CENTER_X = 160
const RULES_CENTER_Y = 104
const STATUS_CENTER_Y = 22

// Window-subsystem font channels: 5 = rules/intro, 1 = top-centre status.
const RULES_CHANNEL = 5
const STATUS_CHANNEL = 1

const RULES_BOX_WIDTH = 120
const RULES_BOX_HEIGHT = 96
const STATUS_BOX_WIDTH = 120
const STATUS_BOX_HEIGHT = 28

export const RULES_MESSAGE_ID = 'cardgame-rules'
export const TRADE_MESSAGE_ID = 'cardgame-trade'
export const QUIT_OPTION_INDEX = 1

const PLAY_OPTION = 'Play'
const QUIT_OPTION = 'Quit'

const centeredPlacement = (
  channel: number,
  centerX: number,
  centerY: number,
  boxWidth: number,
  boxHeight: number,
): MessagePlacement => ({
  channel,
  height: undefined,
  width: undefined,
  x: Math.round(centerX - boxWidth / 2),
  y: Math.round(centerY - boxHeight / 2),
})

export const RULES_PLACEMENT = centeredPlacement(
  RULES_CHANNEL,
  SCREEN_CENTER_X,
  RULES_CENTER_Y,
  RULES_BOX_WIDTH,
  RULES_BOX_HEIGHT,
)
export const STATUS_PLACEMENT = centeredPlacement(
  STATUS_CHANNEL,
  SCREEN_CENTER_X,
  STATUS_CENTER_Y,
  STATUS_BOX_WIDTH,
  STATUS_BOX_HEIGHT,
)

// listActiveRules returns ['Basic'] when no special rule is on, but the real intro box shows only the
// "Rules:" header then — so drop the synthetic 'Basic' fallback.
const getActiveRuleNames = (rules: CardGameRules): string[] => {
  const names = listActiveRules(rules)
  return names.length === 1 && names[0] === 'Basic' ? [] : names
}

const getRulesBodyLineCount = (rules: CardGameRules) => getActiveRuleNames(rules).length + 2

export const buildRulesText = (rules: CardGameRules) =>
  [
    'Rules:',
    ...getActiveRuleNames(rules).map((rule) => `: ${rule}`),
    `Trade Rule: ${getTradeRuleLabel(rules.tradeRule)}`,
    PLAY_OPTION,
    QUIT_OPTION,
  ].join('\n')

export const buildRulesAskOptions = (rules: CardGameRules): AskOptions => {
  const firstOptionLine = getRulesBodyLineCount(rules)
  return { blocked: undefined, cancel: 1, default: firstOptionLine, first: firstOptionLine, last: firstOptionLine + 1 }
}

const cardName = (id: number) => CARD_DEFINITIONS[id].name

export const buildTradeBoxes = (tradeOutcome: TradeOutcome): string[] => [
  ...tradeOutcome.cardsGainedByPlayer.map((id) => `${cardName(id)}\nCard acquired`),
  ...tradeOutcome.cardsLostByPlayer.map((id) => `${cardName(id)}\nCard lost`),
]
