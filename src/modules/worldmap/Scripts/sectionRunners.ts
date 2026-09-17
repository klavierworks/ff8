import { signExtend8 } from '../../../utils'
import { WorldPosition } from '../types'
import { runEventScriptBody } from './eventActions'
import { WORLDMAP_OPCODES } from './opcodes'
import { findScriptBody, readScriptBody, ScriptSection } from './runScript'
import { isLocationTriggerSet } from './state'

export type RawSpawn = {
  positionIndex: number
  typeCode: number
}

const isSpawnOpcode = (op: number) => op === WORLDMAP_OPCODES.ADD_ENTITY || op === WORLDMAP_OPCODES.ADD_ENTITY_ALT

const readMatchingScriptBody = (section: ScriptSection, position: WorldPosition) => {
  const bodyIndex = findScriptBody(section, position, false)
  return bodyIndex === undefined ? [] : readScriptBody(section, bodyIndex)
}

export const findLastBodyOpcode = (section: ScriptSection, position: WorldPosition) =>
  readMatchingScriptBody(section, position).at(-1)

export const runLocationScripts = (section: ScriptSection, position: WorldPosition) =>
  isLocationTriggerSet() ? findLastBodyOpcode(section, position)?.param : undefined

export const collectSpawns = (section: ScriptSection, position: WorldPosition): readonly RawSpawn[] =>
  readMatchingScriptBody(section, position)
    .filter((opcode) => isSpawnOpcode(opcode.op))
    .map((opcode) => ({ positionIndex: signExtend8(opcode.p2), typeCode: opcode.p1 }))

export const runEventScripts = (section: ScriptSection, position: WorldPosition) => {
  const bodyIndex = findScriptBody(section, position, true)
  return bodyIndex === undefined ? undefined : runEventScriptBody(readScriptBody(section, bodyIndex))
}
