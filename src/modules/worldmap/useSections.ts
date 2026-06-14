import type { WorldmapSections } from '@data/types/worldmap/WorldmapSections'

import sectionsData from '@data/worldmap/sections.json'

export type EntityPosition = WorldmapSections['section_10_entity_spawn_positions']['positions'][number]
export type FieldLandingPosition = WorldmapSections['section_8_field_landing_positions']['positions'][number]
export type PlayerLocationScript = WorldmapSections['section_7_player_location_scripts'][number]
export type SpecialLocation = WorldmapSections['section_35_special_locations']['locations'][number]
type Sections = WorldmapSections

// sections.json is bundled at build time, so it is available synchronously; the hook keeps
// its `Sections | undefined` shape for callers but never actually returns undefined.
const SECTIONS = sectionsData as unknown as Sections

const useSections = (): Sections | undefined => SECTIONS

export default useSections
