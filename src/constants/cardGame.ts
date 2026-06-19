import cards from '@data/exe/cards.json'

export type CardDefinition = {
  aiValue: number
  bottom: number
  element: CardElement
  group: CardGroup
  id: number
  left: number
  name: string
  right: number
  top: number
}

export type CardElement = 'earth' | 'fire' | 'holy' | 'ice' | 'none' | 'poison' | 'thunder' | 'water' | 'wind'

export type CardGroup = 'boss' | 'gf' | 'monster' | 'player'

const deriveGroup = (id: number): CardGroup => {
  if (id < 77) {
    return 'monster'
  }
  if (id < 87) {
    return 'gf'
  }
  if (id < 100) {
    return 'boss'
  }
  return 'player'
}

export const CARD_DEFINITIONS: CardDefinition[] = cards.map((card) => ({
  ...card,
  element: card.element as CardElement,
  group: deriveGroup(card.id),
}))

export const CARD_COUNT = CARD_DEFINITIONS.length

// ─── Rules bitfield ───
export const RULE_OPEN = 0x01
export const RULE_SAME = 0x02
export const RULE_PLUS = 0x04
export const RULE_RANDOM = 0x08
export const RULE_SUDDEN_DEATH = 0x10
export const RULE_SAME_WALL = 0x40
export const RULE_ELEMENTAL = 0x80

// ─── Trade rule ───
export const TRADE_NONE = 0
export const TRADE_ONE = 1
export const TRADE_DIFF = 2
export const TRADE_DIRECT = 3
export const TRADE_ALL = 4

// ─── Board / hand geometry ───
export const BOARD_SIZE = 3
export const HAND_SIZE = 5
export const WALL_VALUE = 10

export const PLAYABLE_ELEMENTS: CardElement[] = ['fire', 'ice', 'thunder', 'earth', 'poison', 'wind', 'water', 'holy']
