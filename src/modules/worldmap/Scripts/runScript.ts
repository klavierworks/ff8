import { WorldPosition } from '../types'
import { OPCODE_HANDLERS } from './handlers'
import { OPCODE_NAMES, WORLDMAP_OPCODES } from './opcodes'

export type ScriptResult = {
  didExecuteBody: boolean
  output: number | undefined
  returnCode: 0 | 1 | 3
}

export type WorldmapScript = readonly [number, number, number][]

const GOTO_BYTES_PER_OPCODE = 4

const skipToEndif = (script: WorldmapScript, startIndex: number): number => {
  let depth = 1
  let programCounter = startIndex
  while (programCounter < script.length) {
    const [op] = script[programCounter++]
    if (op === WORLDMAP_OPCODES.IFBLOCK || op === WORLDMAP_OPCODES.NESTEDIF || op === WORLDMAP_OPCODES.NESTEDELSE) {
      depth++
    } else if (op === WORLDMAP_OPCODES.ENDIF) {
      depth--
      if (depth === 0) {
        return programCounter
      }
    }
  }
  return programCounter
}

const skipToReturn = (script: WorldmapScript, startIndex: number): number => {
  let programCounter = startIndex
  while (programCounter < script.length) {
    const [op] = script[programCounter++]
    if (op === WORLDMAP_OPCODES.RETURN) {
      return programCounter
    }
  }
  return programCounter
}

export const runScript = (script: WorldmapScript, position: WorldPosition): ScriptResult => {
  let programCounter = 0
  let collecting: 'inner' | 'outer' | null = null
  let didExecuteBody = false
  let output: number | undefined

  while (programCounter < script.length) {
    const [op, p1, p2] = script[programCounter++]

    switch (op) {
      case WORLDMAP_OPCODES.IF:
        collecting = 'outer'
        continue
      case WORLDMAP_OPCODES.IFBLOCK:
      case WORLDMAP_OPCODES.NESTEDELSE:
      case WORLDMAP_OPCODES.NESTEDIF:
        collecting = 'inner'
        continue
      case WORLDMAP_OPCODES.ELSE:
      case WORLDMAP_OPCODES.ENDIF:
        collecting = null
        continue
      case WORLDMAP_OPCODES.EXEC:
        collecting = null
        didExecuteBody = true
        continue
      case WORLDMAP_OPCODES.RETURN:
        return { didExecuteBody, output, returnCode: 0 }
      case WORLDMAP_OPCODES.RETURN_WITH_CODE_3:
        return { didExecuteBody, output: p1 + p2 * 256, returnCode: 3 }
      case WORLDMAP_OPCODES.RETURN_WITH_VALUE:
        return { didExecuteBody, output: p1 + p2 * 256, returnCode: 1 }
      case WORLDMAP_OPCODES.SET_RETURN_VALUE:
        output = p1 + p2 * 256
        continue
      case WORLDMAP_OPCODES.GOTO: {
        const target = Math.floor((p1 + p2 * 256) / GOTO_BYTES_PER_OPCODE)
        if (target < 0 || target >= script.length) {
          return { didExecuteBody, output, returnCode: 0 }
        }
        programCounter = target
        collecting = null
        continue
      }
    }

    const opName = OPCODE_NAMES[op]
    const handler = opName ? OPCODE_HANDLERS[opName] : undefined
    if (!handler) {
      if (import.meta.env?.DEV) {
        console.warn(`Worldmap script: no handler for opcode ${op}${opName ? ` (${opName})` : ''}`)
      }
      continue
    }
    const result = handler({ p1, p2, param: p1 + p2 * 256, position })
    if (collecting === null || result !== false) {
      continue
    }
    if (collecting === 'outer') {
      programCounter = skipToReturn(script, programCounter)
      return { didExecuteBody, output, returnCode: 0 }
    }
    programCounter = skipToEndif(script, programCounter)
    collecting = null
  }

  return { didExecuteBody, output, returnCode: 0 }
}
