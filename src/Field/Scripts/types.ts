import { RawFieldData } from '../Field'
import { OPCODES } from './constants'

export type Opcode = (typeof OPCODES)[number]

export type OpcodeObj = {
  label?: string
  name: Opcode
  param: number
}

export type Script = Omit<RawFieldData['scripts'][number], 'methods' | 'type'> & {
  methods: ScriptMethod[]
  type: ScriptType
}

export type ScriptMethod = Omit<RawFieldData['scripts'][number]['methods'][number], 'opcodes'> & {
  opcodes: OpcodeObj[]
}

export type ScriptType = 'background' | 'door' | 'location' | 'main' | 'model' | 'unknown'
