const WMSET_MODEL_OFFSET = 64
const WMSET_MODEL_COUNT = 32

// Slot indices 0..6 map to a section extracted as world_NNN.gltf; higher
// indices reference chara.one archives absent from this dataset and are skipped.
const CHARAONE_MESH_SLOTS: ReadonlyMap<number, readonly number[]> = new Map([
  [0, [0, 1]],
  [1, [4, 5, 6, 7]],
  [2, [2, 3]],
  [3, [2, 3]],
  [4, [0, 1]],
  [5, [0, 1]],
  [6, [0, 1]],
])

const CHARAONE_SECTION_COUNT = 7

export type ModelReference = { index: number; kind: 'wmset' } | { kind: 'charaone'; sectionIndices: readonly number[] }

export const getModelForEntity = (typeCode: number): ModelReference | undefined => {
  if (typeCode >= WMSET_MODEL_OFFSET) {
    const index = typeCode - WMSET_MODEL_OFFSET
    if (index < WMSET_MODEL_COUNT) {
      return { index, kind: 'wmset' }
    }
    return undefined
  }
  const slots = CHARAONE_MESH_SLOTS.get(typeCode)
  if (!slots) {
    return undefined
  }
  const sectionIndices = slots.filter((slot) => slot < CHARAONE_SECTION_COUNT)
  return { kind: 'charaone', sectionIndices }
}
