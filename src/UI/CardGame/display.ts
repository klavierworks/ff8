import { TRADE_ALL, TRADE_DIFF, TRADE_DIRECT, TRADE_ONE } from '../../constants/cardGame'
import { CardGameRules } from './types'

const TRADE_LABEL: Record<number, string> = {
  [TRADE_ALL]: 'All',
  [TRADE_DIFF]: 'Diff',
  [TRADE_DIRECT]: 'Direct',
  [TRADE_ONE]: 'One',
}

export const listActiveRules = (rules: CardGameRules): string[] => {
  const active = [
    rules.isOpen && 'Open',
    rules.isSame && 'Same',
    rules.isSameWall && 'Same Wall',
    rules.isPlus && 'Plus',
    rules.isElemental && 'Elemental',
    rules.isSuddenDeath && 'Sudden Death',
  ].filter((rule): rule is string => Boolean(rule))

  return active.length > 0 ? active : ['Basic']
}

export const getTradeRuleLabel = (tradeRule: number) => TRADE_LABEL[tradeRule] ?? 'None'
