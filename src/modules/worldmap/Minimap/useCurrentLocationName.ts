import { formatNameTags } from '../../../UI/textUtils'
import { SEGMENT_SIZE_THREE, WORLD_GRID_COLS, WORLD_GRID_ROWS } from '../constants'
import useSections from '../useSections'
import { positiveModulo } from '../worldPosition'

const positionToCellIndex = (worldX: number, worldZ: number) => {
  const col = positiveModulo(Math.floor(worldX / SEGMENT_SIZE_THREE), WORLD_GRID_COLS)
  const row = positiveModulo(Math.floor(worldZ / SEGMENT_SIZE_THREE), WORLD_GRID_ROWS)
  return row * WORLD_GRID_COLS + col
}

const useCurrentLocationName = (worldX: number, worldZ: number): string | undefined => {
  const sections = useSections()
  if (!sections) {
    return undefined
  }

  const cellIndex = positionToCellIndex(worldX, worldZ)
  const locationId = sections.section_18_region_location_ids.region_location_ids[cellIndex]
  if (!locationId) {
    return undefined
  }
  const rawName = sections.section_31_location_names.location_names[locationId]
  if (!rawName) {
    return undefined
  }
  return formatNameTags(rawName)
}

export default useCurrentLocationName
