import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { getGameData } from '../../gameData'

export const WORLDMAP_SECTIONS = getGameData().sections as unknown as WorldmapSections
