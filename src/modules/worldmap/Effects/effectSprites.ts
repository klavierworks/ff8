import type { WorldmapEffects } from '@data/types/worldmap/WorldmapEffects'

import { getAssetUrl } from '../../../assetManifest'
import { getGameData } from '../../../gameData'

const SPRITE_PATH_PREFIX = 'worldmap/'

export const EFFECT_DEFINITIONS = getGameData().effects as WorldmapEffects

export const SPRITE_FILES = [
  ...new Set(EFFECT_DEFINITIONS.flatMap((definition) => (definition.sprite ? [definition.sprite.file] : []))),
]

export const SPRITE_URLS = SPRITE_FILES.map((file) => getAssetUrl(`${SPRITE_PATH_PREFIX}${file}`))
