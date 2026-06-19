// ─── Card data + rules (verbatim from FF8_EN.exe; see ida.md "Triple Triad") ───

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

// [name, top(UP), right(R), bottom(DOWN), left(L), element, aiValue]
type RawCard = [string, number, number, number, number, CardElement, number]

const RAW_CARDS: RawCard[] = [
  ['Geezard', 1, 4, 1, 5, 'none', 21],
  ['Funguar', 5, 1, 1, 3, 'none', 18],
  ['Bite Bug', 1, 3, 3, 5, 'none', 22],
  ['Red Bat', 6, 1, 1, 2, 'none', 21],
  ['Blobra', 2, 3, 1, 5, 'none', 19],
  ['Gayla', 2, 1, 4, 4, 'fire', 18],
  ['Gesper', 1, 5, 4, 1, 'none', 21],
  ['Fastitocalon-F', 3, 5, 2, 1, 'ice', 19],
  ['Blood Soul', 2, 1, 6, 1, 'none', 21],
  ['Caterchipillar', 4, 2, 4, 3, 'none', 22],
  ['Cockatrice', 2, 1, 2, 6, 'fire', 22],
  ['Grat', 7, 1, 3, 1, 'none', 30],
  ['Buel', 6, 2, 2, 3, 'none', 26],
  ['Mesmerize', 5, 3, 3, 4, 'none', 29],
  ['Glacial Eye', 6, 1, 4, 3, 'holy', 31],
  ['Belhelmel', 3, 4, 5, 3, 'none', 29],
  ['Thrustaevis', 5, 3, 2, 5, 'earth', 31],
  ['Anacondaur', 5, 1, 3, 5, 'thunder', 30],
  ['Creeps', 5, 2, 5, 2, 'fire', 29],
  ['Grendel', 4, 4, 5, 2, 'fire', 30],
  ['Jelleye', 3, 2, 1, 7, 'none', 31],
  ['Grand Mantis', 5, 2, 5, 3, 'none', 31],
  ['Forbidden', 6, 6, 3, 2, 'none', 42],
  ['Armadodo', 6, 3, 1, 6, 'ice', 41],
  ['Tri-Face', 3, 5, 5, 5, 'thunder', 42],
  ['Fastitocalon', 7, 5, 1, 3, 'ice', 42],
  ['Snow Lion', 7, 1, 5, 3, 'holy', 42],
  ['Ochu', 5, 6, 3, 3, 'none', 39],
  ['SAM08G', 5, 6, 2, 4, 'water', 40],
  ['Death Claw', 4, 4, 7, 2, 'water', 42],
  ['Cactuar', 6, 2, 6, 3, 'none', 42],
  ['Tonberry', 3, 6, 4, 4, 'none', 38],
  ['Abyss Worm', 7, 2, 3, 5, 'ice', 43],
  ['Turtapod', 2, 3, 6, 7, 'none', 49],
  ['Vysage', 6, 5, 4, 5, 'none', 51],
  ['T-Rexaur', 4, 6, 2, 7, 'none', 52],
  ['Bomb', 2, 7, 6, 3, 'water', 49],
  ['Blitz', 1, 6, 4, 7, 'fire', 51],
  ['Wendigo', 7, 3, 1, 6, 'none', 47],
  ['Torama', 7, 4, 4, 4, 'none', 48],
  ['Imp', 3, 7, 3, 6, 'none', 51],
  ['Blue Dragon', 6, 2, 7, 3, 'thunder', 49],
  ['Adamantoise', 4, 5, 5, 6, 'ice', 51],
  ['Hexadragon', 7, 5, 4, 3, 'water', 49],
  ['Iron Giant', 6, 5, 6, 5, 'none', 61],
  ['Behemoth', 3, 6, 5, 7, 'none', 59],
  ['Chimera', 7, 6, 5, 3, 'poison', 59],
  ['PuPu', 3, 10, 2, 1, 'none', 57],
  ['Elastoid', 6, 2, 6, 7, 'none', 62],
  ['GIM47N', 5, 5, 7, 4, 'none', 57],
  ['Malboro', 7, 7, 4, 2, 'thunder', 59],
  ['Ruby Dragon', 7, 2, 7, 4, 'water', 59],
  ['Elnoyle', 5, 3, 7, 6, 'none', 59],
  ['Tonberry King', 4, 6, 7, 4, 'none', 58],
  ['Wedge, Biggs', 6, 6, 2, 7, 'none', 62],
  ['Fujin, Raijin', 2, 8, 8, 4, 'none', 74],
  ['Elvoret', 7, 8, 3, 4, 'earth', 69],
  ['X-ATM092', 4, 8, 7, 3, 'none', 69],
  ['Granaldo', 7, 2, 8, 5, 'none', 71],
  ['Gerogero', 1, 8, 8, 3, 'thunder', 69],
  ['Iguion', 8, 2, 8, 2, 'none', 68],
  ['Abadon', 6, 8, 4, 5, 'none', 70],
  ['Trauma', 4, 8, 5, 6, 'none', 70],
  ['Oilboyle', 1, 8, 4, 8, 'none', 72],
  ['Shumi Tribe', 6, 5, 8, 4, 'none', 70],
  ['Krysta', 7, 5, 8, 1, 'none', 69],
  ['Propagator', 8, 4, 4, 8, 'none', 80],
  ['Jumbo Cactuar', 8, 8, 4, 4, 'none', 80],
  ['Tri-Point', 8, 5, 2, 8, 'fire', 78],
  ['Gargantua', 5, 6, 6, 8, 'none', 80],
  ['Mobile Type 8', 8, 6, 7, 3, 'none', 79],
  ['Sphinxara', 8, 3, 5, 8, 'none', 81],
  ['Tiamat', 8, 8, 5, 4, 'none', 84],
  ['BGH251F2', 5, 7, 8, 5, 'none', 81],
  ['Red Giant', 6, 8, 4, 7, 'none', 82],
  ['Catoblepas', 1, 8, 7, 7, 'none', 81],
  ['Ultima Weapon', 7, 7, 2, 8, 'none', 83],
  ['Chubby Chocobo', 4, 4, 8, 9, 'none', 88],
  ['Angelo', 9, 6, 7, 3, 'none', 87],
  ['Gilgamesh', 3, 7, 9, 6, 'none', 87],
  ['MiniMog', 9, 3, 9, 2, 'none', 87],
  ['Chicobo', 9, 4, 8, 4, 'none', 88],
  ['Quezacotl', 2, 9, 9, 4, 'fire', 91],
  ['Shiva', 6, 7, 4, 9, 'holy', 91],
  ['Ifrit', 9, 6, 2, 8, 'water', 92],
  ['Siren', 8, 9, 6, 2, 'none', 92],
  ['Sacred', 5, 1, 9, 9, 'ice', 94],
  ['Minotaur', 9, 5, 2, 9, 'ice', 95],
  ['Carbuncle', 8, 4, 10, 4, 'none', 98],
  ['Diablos', 5, 10, 8, 3, 'none', 99],
  ['Leviathan', 7, 10, 1, 7, 'poison', 99],
  ['Odin', 8, 10, 3, 5, 'none', 99],
  ['Pandemona', 10, 1, 7, 7, 'earth', 99],
  ['Cerberus', 7, 4, 6, 10, 'none', 100],
  ['Alexander', 9, 10, 4, 2, 'wind', 100],
  ['Phoenix', 7, 2, 7, 10, 'water', 101],
  ['Bahamut', 10, 8, 2, 6, 'none', 102],
  ['Doomtrain', 3, 1, 10, 10, 'thunder', 105],
  ['Eden', 4, 4, 9, 10, 'none', 106],
  ['Ward', 10, 7, 2, 8, 'none', 108],
  ['Kiros', 6, 7, 6, 10, 'none', 110],
  ['Laguna', 5, 10, 3, 9, 'none', 107],
  ['Selphie', 10, 8, 6, 4, 'none', 108],
  ['Quistis', 9, 6, 10, 2, 'none', 110],
  ['Irvine', 2, 6, 9, 10, 'none', 110],
  ['Zell', 8, 5, 10, 6, 'none', 112],
  ['Rinoa', 4, 10, 2, 10, 'none', 110],
  ['Edea', 10, 10, 3, 3, 'none', 109],
  ['Seifer', 6, 9, 10, 4, 'none', 116],
  ['Squall', 10, 4, 6, 9, 'none', 116],
]

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

export const CARD_DEFINITIONS: CardDefinition[] = RAW_CARDS.map(
  ([name, top, right, bottom, left, element, aiValue], id) => ({
    aiValue,
    bottom,
    element,
    group: deriveGroup(id),
    id,
    left,
    name,
    right,
    top,
  }),
)

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
