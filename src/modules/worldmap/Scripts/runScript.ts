import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { WorldPosition } from '../types'
import { MAX_STEPS_PER_SCRIPT_FACTOR, OPCODE_PARAM_HIGH_BYTE_FACTOR, SCRIPT_OPCODE_SIZE } from './constants'
import { checkCondition } from './handlers'
import { WORLDMAP_OPCODES } from './opcodes'

export type ScriptOpcode = {
  op: number
  p1: number
  p2: number
  param: number
}

export type ScriptSection = WorldmapSections['section_7_player_location_scripts']

type Block = 'body' | 'conditions' | 'none'

type BodyMode = 'collecting' | 'collectingElseIf' | 'executing' | 'executingElse' | 'skipping' | 'skippingElseIf'

type Step =
  | { index: number; kind: 'body' }
  | { kind: 'continue'; walker: Walker }
  | { kind: 'nextScript' }
  | { kind: 'stop' }

type Walker = {
  block: Block
  mode: BodyMode
  programCounter: number
}

const readOpcode = (section: ScriptSection, index: number): ScriptOpcode | undefined => {
  const entry = section.opcodes[index]
  if (!entry) {
    return undefined
  }
  const [op, p1, p2] = entry
  return { op, p1, p2, param: p1 + p2 * OPCODE_PARAM_HIGH_BYTE_FACTOR }
}

const getGotoIndex = (section: ScriptSection, opcode: ScriptOpcode) =>
  (opcode.param - section.base_offset) / SCRIPT_OPCODE_SIZE

const advance = (walker: Walker, changes: Partial<Walker> = {}): Step => ({
  kind: 'continue',
  walker: { ...walker, ...changes, programCounter: walker.programCounter + 1 },
})

const jump = (walker: Walker, section: ScriptSection, opcode: ScriptOpcode): Step => ({
  kind: 'continue',
  walker: { ...walker, programCounter: getGotoIndex(section, opcode) },
})

const isCollecting = (mode: BodyMode) => mode === 'collecting' || mode === 'collectingElseIf'
const isExecuting = (mode: BodyMode) => mode === 'executing' || mode === 'executingElse'
const isSkipping = (mode: BodyMode) => mode === 'skipping' || mode === 'skippingElseIf'

const getMaxSteps = (section: ScriptSection) => section.opcodes.length * MAX_STEPS_PER_SCRIPT_FACTOR

const stepCondition = (
  walker: Walker,
  section: ScriptSection,
  opcode: ScriptOpcode,
  position: WorldPosition,
  failStep: Step,
): Step => {
  const result = checkCondition(opcode, position)
  if (result === 'fail') {
    return failStep
  }
  if (result === 'none' && opcode.op === WORLDMAP_OPCODES.GOTO) {
    return jump(walker, section, opcode)
  }
  return advance(walker)
}

const stepBodyOpcode = (
  walker: Walker,
  section: ScriptSection,
  opcode: ScriptOpcode,
  position: WorldPosition,
): Step => {
  const { mode } = walker
  if (isCollecting(mode)) {
    const skippingMode = mode === 'collecting' ? 'skipping' : 'skippingElseIf'
    return stepCondition(walker, section, opcode, position, advance(walker, { mode: skippingMode }))
  }
  if (isExecuting(mode)) {
    return opcode.op === WORLDMAP_OPCODES.GOTO
      ? jump(walker, section, opcode)
      : { index: walker.programCounter, kind: 'body' }
  }
  return advance(walker)
}

const stepBody = (
  walker: Walker,
  section: ScriptSection,
  opcode: ScriptOpcode,
  position: WorldPosition,
  isWarpMode: boolean,
): Step => {
  const { mode } = walker
  switch (opcode.op) {
    case WORLDMAP_OPCODES.ELSE:
      return advance(walker, isSkipping(mode) ? { mode: 'executingElse' } : {})
    case WORLDMAP_OPCODES.ELSE_IF:
      return advance(walker, isSkipping(mode) ? { mode: 'collectingElseIf' } : {})
    case WORLDMAP_OPCODES.END_BLOCK:
      return isSkipping(mode) ? advance(walker) : { kind: 'nextScript' }
    case WORLDMAP_OPCODES.IF:
      return advance(walker, { mode: 'collecting' })
    case WORLDMAP_OPCODES.RETURN:
      return isWarpMode ? { kind: 'nextScript' } : { kind: 'stop' }
    case WORLDMAP_OPCODES.THEN:
      return advance(walker, isCollecting(mode) ? { mode: 'executing' } : {})
    default:
      return stepBodyOpcode(walker, section, opcode, position)
  }
}

const stepScript = (walker: Walker, section: ScriptSection, position: WorldPosition, isWarpMode: boolean): Step => {
  const opcode = readOpcode(section, walker.programCounter)
  if (!opcode) {
    return { kind: 'nextScript' }
  }
  if (opcode.op === WORLDMAP_OPCODES.BEGIN_CONDITIONS) {
    return advance(walker, { block: 'conditions' })
  }
  if (opcode.op === WORLDMAP_OPCODES.BEGIN_BODY) {
    return advance(walker, { block: 'body', mode: 'executing' })
  }
  if (walker.block === 'none') {
    return advance(walker)
  }
  if (walker.block === 'conditions') {
    return stepCondition(walker, section, opcode, position, { kind: 'nextScript' })
  }
  return stepBody(walker, section, opcode, position, isWarpMode)
}

const runOneScript = (
  section: ScriptSection,
  start: number,
  position: WorldPosition,
  isWarpMode: boolean,
): Exclude<Step, { kind: 'continue' }> => {
  const maxSteps = getMaxSteps(section)
  let walker: Walker = { block: 'none', mode: 'executing', programCounter: start }
  for (let steps = 0; steps < maxSteps; steps++) {
    const step = stepScript(walker, section, position, isWarpMode)
    if (step.kind !== 'continue') {
      return step
    }
    walker = step.walker
  }
  return { kind: 'stop' }
}

export const findScriptBody = (section: ScriptSection, position: WorldPosition, isWarpMode: boolean) => {
  for (const start of section.script_starts) {
    const step = runOneScript(section, start, position, isWarpMode)
    if (step.kind === 'body') {
      return step.index
    }
    if (step.kind === 'stop') {
      return undefined
    }
  }
  return undefined
}

export const readScriptBody = (section: ScriptSection, bodyIndex: number): readonly ScriptOpcode[] => {
  const maxSteps = getMaxSteps(section)
  const body: ScriptOpcode[] = []
  let programCounter = bodyIndex
  for (let steps = 0; steps < maxSteps; steps++) {
    const opcode = readOpcode(section, programCounter)
    if (!opcode || opcode.op === WORLDMAP_OPCODES.END_BLOCK) {
      return body
    }
    if (opcode.op === WORLDMAP_OPCODES.GOTO) {
      programCounter = getGotoIndex(section, opcode)
      continue
    }
    body.push(opcode)
    programCounter++
  }
  return body
}
