import {
  CHARAONE_MESH_SLOTS,
  CHARAONE_SECTION_COUNT,
  FIRST_WMSET_ENTITY_TYPE,
  WMSET_MODEL_COUNT,
} from '../../../../constants/worldmapEntities'
import { CHARAONE_MODEL_PITCH_X, CHARAONE_MODEL_SCALE, WMSET_MODEL_SCALE } from '../../constants'

export type ModelReference = { index: number; kind: 'wmset' } | { kind: 'charaone'; sectionIndices: readonly number[] }

const getWmsetModel = (typeCode: number): ModelReference | undefined => {
  const index = typeCode - FIRST_WMSET_ENTITY_TYPE
  return index < WMSET_MODEL_COUNT ? { index, kind: 'wmset' } : undefined
}

const getCharaoneModel = (typeCode: number): ModelReference | undefined => {
  const slots = CHARAONE_MESH_SLOTS.get(typeCode)
  if (!slots) {
    return undefined
  }
  return { kind: 'charaone', sectionIndices: slots.filter((slot) => slot < CHARAONE_SECTION_COUNT) }
}

export const getModelForEntity = (typeCode: number) =>
  typeCode >= FIRST_WMSET_ENTITY_TYPE ? getWmsetModel(typeCode) : getCharaoneModel(typeCode)

export const getModelScale = (model: ModelReference | undefined) =>
  model?.kind === 'charaone' ? CHARAONE_MODEL_SCALE : WMSET_MODEL_SCALE

export const getModelPitch = (model: ModelReference | undefined) =>
  model?.kind === 'charaone' ? CHARAONE_MODEL_PITCH_X : 0
