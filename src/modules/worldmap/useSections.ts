import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import sectionsData from '@data/worldmap/sections.json'

export type EntityPosition = WorldmapSections['section_10_entity_spawn_positions']['positions'][number]
export type FieldLandingPosition = WorldmapSections['section_8_field_landing_positions']['positions'][number]

const SECTIONS = sectionsData as unknown as WorldmapSections

const useSections = () => SECTIONS

export default useSections
