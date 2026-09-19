import namedic from '@data/menu/namedic.json'

import { CONTROLS_MAP } from '../constants/controls'
import { MESSAGE_VARS } from '../modules/field/Scripts/Script/handlers'
import { Modifier } from './textTypes'

export const createModifier = (tag: string) => {
  let result: Modifier = {
    type: 'unknownModifier',
  }

  switch (tag) {
    case 'Blue':
    case 'BlueBlink':
      result = {
        color: 'blue',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Darkgrey':
    case 'DarkgreyBlink':
      result = {
        color: 'shadow',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Green':
    case 'GreenBlink':
      result = {
        color: 'green',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Grey':
    case 'GreyBlink':
      result = {
        color: 'gray',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Purple':
    case 'PurpleBlink':
      result = {
        color: 'magenta',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Red':
    case 'RedBlink':
      result = {
        color: 'red',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'White':
    case 'WhiteBlink':
      result = {
        color: 'white',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    case 'Yellow':
    case 'YellowBlink':
      result = {
        color: 'yellow',
        isBlinking: tag.includes('Blink'),
        type: 'color',
      }
      break
    default:
      break
  }

  if (result.type !== 'unknownModifier') {
    return result
  }

  if (tag.startsWith('Wait')) {
    result = {
      duration: parseInt(tag.substring(4)),
      type: 'wait',
    }
    return result
  }

  console.log('unknownModifier', tag, result)
  return result
}

const NAME_TAGS = {
  '{Angelo}': 'Angelo',
  '{Balamb}': 'Balamb',
  '{Boko}': 'Boko',
  '{Centra}': 'Centra',
  '{Dollet}': 'Dollet',
  '{Edea}': 'Edea',
  '{Esthar}': 'Esthar',
  '{Galbadia}': 'Galbadia',
  '{Griever}': 'Griever',
  '{Horizon}': 'Horizon',
  '{Irvine}': 'Irvine',
  '{Kiros}': 'Kiros',
  '{Laguna}': 'Laguna',
  '{Quistis}': 'Quistis',
  '{Rinoa}': 'Rinoa',
  '{Seifer}': 'Seifer',
  '{Selphie}': 'Selphie',
  '{Squall}': 'Squall',
  '{Timber}': 'Timber',
  '{Trabia}': 'Trabia',
  '{Ward}': 'Ward',
  '{Zell}': 'Zell',
}

const CONTROL_INPUTS = {
  '{x052b}': CONTROLS_MAP.start,
  '{x052c}': 'UP',
  '{x052d}': 'RIGHT',
  '{x052e}': 'DOWN',
  '{x052f}': 'LEFT',
  '{x053b}': CONTROLS_MAP.start,
  '{x053c}': 'UP',
  '{x053d}': 'RIGHT',
  '{x053e}': 'DOWN',
  '{x053f}': 'LEFT',
  '{x0520}': 'L2',
  '{x0521}': 'R2',
  '{x0522}': CONTROLS_MAP.l1,
  '{x0523}': CONTROLS_MAP.r1,
  '{x0524}': CONTROLS_MAP.cancel,
  '{x0525}': CONTROLS_MAP.menu,
  '{x0526}': CONTROLS_MAP.confirm,
  '{x0527}': CONTROLS_MAP.card,
  '{x0528}': CONTROLS_MAP.select,
  '{x0530}': 'L2',
  '{x0531}': 'R2',
  '{x0532}': CONTROLS_MAP.l1,
  '{x0533}': CONTROLS_MAP.r1,
  '{x0534}': CONTROLS_MAP.cancel,
  '{x0535}': CONTROLS_MAP.menu,
  '{x0536}': CONTROLS_MAP.confirm,
  '{x0537}': CONTROLS_MAP.card,
  '{x0538}': CONTROLS_MAP.select,
}

const findAndReplaceVarPatterns = (inputString: string, replacementFn: (string: string) => string) => {
  const regex = /\{(Var\d|Var\d\d|Varb\d)\}/g

  return inputString.replace(regex, (_, capturedGroup) => {
    return replacementFn(capturedGroup)
  })
}

const FIRST_NAME_DICTIONARY_CODE = 0x20
const NAME_DICTIONARY_TOKEN = /\{x0e([0-9a-f]{2})\}/g

export const resolveNameDictionaryTokens = (text: string) =>
  text.replace(
    NAME_DICTIONARY_TOKEN,
    (_, hex: string) => (namedic as string[])[parseInt(hex, 16) - FIRST_NAME_DICTIONARY_CODE] ?? '',
  )

export const formatNameTags = (string: string) => {
  let formattedString = resolveNameDictionaryTokens(string)
  Object.entries(NAME_TAGS).forEach(([tag, name]) => {
    formattedString = formattedString.replaceAll(tag, name)
  })
  Object.entries(CONTROL_INPUTS).forEach(([tag, name]) => {
    formattedString = formattedString.replaceAll(tag, name)
  })

  const result = findAndReplaceVarPatterns(formattedString, (match) => {
    const index = parseInt(match.replace(/\D/g, ''))
    return MESSAGE_VARS[index]
  })

  return result
}

export const isSavePointMessage = (message: Message) => message.text[0].startsWith(`【Save Point】`)
