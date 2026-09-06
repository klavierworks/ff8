import { Scene, Vector3 } from 'three'

import MAP_NAMES from '../../constants/maps'
import useGlobalStore from '../../store'
import { getInitialEntrance } from '../../utils'
import { FieldData, RawFieldData } from './Field'
import { OPCODES } from './Scripts/constants'
import { MEMORY, restoreMemory } from './Scripts/Script/handlers'
import { getPlayerEntity } from './Scripts/Script/Model/modelUtils'
import { Opcode, OpcodeObj, ScriptType } from './Scripts/types'

type UnmappedOpcodes = [number, number] | [string, number]
const getMappedOpcodes = (opcodes: UnmappedOpcodes[]): OpcodeObj[] => {
  return opcodes.map((opcode) => {
    const [name, param] = opcode

    return {
      code: name,
      name: (typeof name === 'string' ? name : OPCODES[name]) as Opcode,
      param,
    }
  })
}

const getFormattedTiles = (tiles: RawFieldData['tiles']) => {
  return tiles.map((tile) => {
    return {
      blendType: tile[9],
      depth: tile[6],
      index: tile[0],
      isBlended: tile[5],
      layerID: tile[8],
      palID: tile[7],
      parameter: tile[10],
      state: tile[11],
      texID: tile[4],
      X: tile[1],
      Y: tile[2],
      Z: tile[3],
    }
  })
}

const FIELD_DATA = import.meta.glob<{ default: RawFieldData }>('/extractor/data/converted/field/mapdata/*/data.json')

export const getFieldData = async (fieldId: string) => {
  const loadFieldData = FIELD_DATA[`/extractor/data/converted/field/mapdata/${fieldId}/data.json`]
  if (!loadFieldData) {
    throw new Error(`No field data for ${fieldId}`)
  }
  const data = (await loadFieldData()).default

  const withMappedOpcodes = {
    ...data,
    scripts: data.scripts.map((script) => {
      return {
        ...script,
        methods: script.methods.map((method) => {
          return {
            ...method,
            opcodes: getMappedOpcodes(method.opcodes as [number, number][]),
          }
        }),
        type: script.type as ScriptType,
      }
    }),
    tiles: getFormattedTiles(data.tiles),
  }

  return withMappedOpcodes
}

export const getRequestedSpawn = (
  fieldData: FieldData,
  pendingPosition: undefined | Vector3,
  pendingTriangle: number | undefined,
) => {
  if (pendingPosition) {
    return { position: pendingPosition, triangle: pendingTriangle }
  }
  if (pendingTriangle !== undefined) {
    return { position: undefined, triangle: pendingTriangle }
  }
  return getInitialEntrance(fieldData)
}

type SaveData = {
  availableCharacters: number[]
  characterPosition: VectorLike
  fieldId: (typeof MAP_NAMES)[number]
  MEMORY: typeof MEMORY
  party: number[]
}

export const saveGame = (scene: Scene) => {
  const { availableCharacters, fieldId, party } = useGlobalStore.getState()
  const player = getPlayerEntity(scene)

  if (!player) {
    console.warn('Player not found')
    return
  }
  const position = new Vector3()
  player.getWorldPosition(position)

  const saveData: SaveData = {
    availableCharacters,
    characterPosition: position,
    fieldId: fieldId!,
    MEMORY: {
      ...MEMORY,
      87: 0,
      261: 1,
    },
    party,
  }
  window.localStorage.setItem('saveData', JSON.stringify(saveData))
}

export const loadGame = () => {
  const saveData = window.localStorage.getItem('saveData')
  if (!saveData) {
    console.warn('No save data found')
    return
  }
  const parsedData = JSON.parse(saveData) as SaveData

  const { availableCharacters, characterPosition, fieldId, party } = parsedData

  useGlobalStore.setState({
    availableCharacters,
    fieldId: undefined,
    isLoadingSavedGame: true,
    party,
    pendingCharacterPosition: new Vector3(characterPosition.x, characterPosition.y, characterPosition.z),
    pendingFieldId: fieldId,
  })

  restoreMemory(parsedData.MEMORY)
}
