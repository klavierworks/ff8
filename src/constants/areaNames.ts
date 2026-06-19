import areaNames from '@data/menu/area-names.json'
import namedic from '@data/menu/namedic.json'

// Area names carry raw {x0eNN} location tokens that index the namedic dictionary
// (NN - 0x20). The extracted JSON keeps them raw; resolve to display text here.
const NAMEDIC_TOKEN = /\{x0e([0-9a-f]{2})\}/g

const resolveNamedic = (text: string) =>
  text.replace(NAMEDIC_TOKEN, (_, hex: string) => namedic[parseInt(hex, 16) - 0x20] ?? '')

export const AREA_NAMES: readonly string[] = areaNames.map(resolveNamedic)
