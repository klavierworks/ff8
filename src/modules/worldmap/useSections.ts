import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import { WORLDMAP_SECTIONS } from './worldmapSections'

export type EntityPosition = WorldmapSections['section_10_entity_spawn_positions']['positions'][number]
export type FieldLandingPosition = WorldmapSections['section_8_field_landing_positions']['positions'][number]

const useSections = () => WORLDMAP_SECTIONS

export default useSections
