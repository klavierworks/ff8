import { warmCache } from '../../assetManifest'
import { MEMORY } from '../field/Scripts/Script/handlers'
import { VISIBLE_TILE_RADIUS } from './constants'
import { SPRITE_URLS } from './Effects/effectSprites'
import { MINIMAP_TEXTURE_URLS } from './Minimap/MinimapView/minimapTextureUrls'
import { CLOUD_TEXTURE_URL } from './Sky/skyUtils'
import { getActiveVariantOverrides } from './Tiles/tileState'
import { getSegmentPosition, getTilesAround, getTileUrl, isDDistrictPrisonAboveGround } from './Tiles/tilesUtils'
import { resolveWorldmapEntry } from './worldmapEntry'
import { getWorldStateVariable } from './worldmapSaveData'
import { WORLDMAP_SECTIONS } from './worldmapSections'
import useWorldmapStore from './worldmapStore'

const getEntryPosition = () => {
  const { entryMode, spawnPointId, vehicleId } = useWorldmapStore.getState()
  const landings = WORLDMAP_SECTIONS.section_8_field_landing_positions.positions
  return resolveWorldmapEntry({ entryMode, landings, memory: MEMORY, spawnPointId, vehicleId }).position
}

const getEntryTileUrls = () => {
  const variantOverrides = getActiveVariantOverrides(
    getWorldStateVariable(MEMORY),
    isDDistrictPrisonAboveGround(MEMORY),
  )
  return getTilesAround(getSegmentPosition(getEntryPosition()), VISIBLE_TILE_RADIUS, variantOverrides).map((tile) =>
    getTileUrl(tile.assetPath),
  )
}

export const preloadWorldmapEntry = async () => {
  const urls = [...getEntryTileUrls(), CLOUD_TEXTURE_URL, ...SPRITE_URLS, ...MINIMAP_TEXTURE_URLS]
  await Promise.all(urls.map(warmCache))
}
