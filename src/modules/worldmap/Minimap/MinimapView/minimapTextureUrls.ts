import { getAssetUrl } from '../../../../assetManifest'
import cursorUrl from '../../../../assets/cursor.png?url'

const WORLD_TEXTURE_NAMES = ['world_11', 'world_11_1', 'world_25', 'world_24']

export const MINIMAP_TEXTURE_URLS = [
  ...WORLD_TEXTURE_NAMES.map((name) => getAssetUrl(`worldmap/textures/world/${name}.png`)),
  cursorUrl,
]
