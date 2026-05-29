// Each entity typeCode belongs to a category. The category code shares a
// namespace with the player's current vehicle code, so equality checks between
// "what is this entity" and "what is the player" compare directly.

type CategoryDefinition = {
  category: number
  typeCodes: readonly number[]
}

const CATEGORIES: readonly CategoryDefinition[] = [
  { category: 0, typeCodes: [0] },
  { category: 1, typeCodes: [4] },
  { category: 2, typeCodes: [5] },
  { category: 6, typeCodes: [6] },
  { category: 32, typeCodes: [74, 75] }, // Balamb Garden
  { category: 33, typeCodes: [73] }, // Balamb Garden
  { category: 34, typeCodes: [81] }, // Balamb Garden
  { category: 35, typeCodes: [82] }, // Balamb Garden
  { category: 36, typeCodes: [83] }, // Balamb Garden
  { category: 37, typeCodes: [84] }, // Balamb Garden
  { category: 38, typeCodes: [85] }, // Balamb Garden
  { category: 39, typeCodes: [86] }, // Balamb Garden
  { category: 40, typeCodes: [87] }, // Balamb Garden
  { category: 48, typeCodes: [64, 65] }, // Balamb Garden (boarded)
  { category: 49, typeCodes: [2, 3] }, // chocobo
  { category: 50, typeCodes: [1] }, // Ragnarok
  { category: 65, typeCodes: [77] },
  { category: 66, typeCodes: [78] },
  { category: 131, typeCodes: [70] },
]

const CATEGORY_BY_TYPE_CODE: ReadonlyMap<number, number> = new Map(
  CATEGORIES.flatMap(({ category, typeCodes }) => typeCodes.map((typeCode) => [typeCode, category] as const)),
)

export const getCategoryForEntity = (typeCode: number): number | undefined => CATEGORY_BY_TYPE_CODE.get(typeCode)
