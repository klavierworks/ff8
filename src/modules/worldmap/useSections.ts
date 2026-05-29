import { useEffect, useState } from 'react'

import { SkyZone } from './Sky/skyUtils'

const SECTIONS_URL = '/worldmap/wmset/sections.json'

export type AkaoSection = { akao_data: string }

export type EntityPosition = {
  pitch: number
  x: number
  y: number
  yaw: number
  z: number
}

export type FieldLandingPosition = {
  player_yaw: number
  vehicle_yaw: number
  x: number
  y: number
  z: number
}

export type PlayerLocationScript = readonly [number, number, number][]

export type Sections = {
  section_1_region_grid: {
    height: number
    region_cells: readonly number[]
    width: number
  }
  section_7_player_location_scripts: readonly PlayerLocationScript[]
  section_8_field_landing_positions: {
    positions: readonly FieldLandingPosition[]
  }
  section_9_entity_spawn_scripts: readonly PlayerLocationScript[]
  section_10_entity_spawn_positions: {
    positions: readonly EntityPosition[]
  }
  section_13_dialog_text: { dialog: readonly string[] }
  section_18_region_location_ids: { region_location_ids: readonly number[] }
  section_31_location_names: { location_names: readonly string[] }
  section_32_sky_color_zones: { zones: readonly SkyZone[] }
  section_35_special_locations: { locations: readonly SpecialLocation[] }
  section_42_music: AkaoSection
  section_43_music: AkaoSection
  section_44_music: AkaoSection
  section_45_music: AkaoSection
  section_46_music: AkaoSection
  section_47_music: AkaoSection
}

export type SpecialLocation = {
  extra: number
  type_code: number
  x: number
  y: number
  z: number
}

let cached: Sections | undefined
let inflight: Promise<Sections> | undefined

const fetchSections = (): Promise<Sections> => {
  if (cached) {
    return Promise.resolve(cached)
  }
  if (inflight) {
    return inflight
  }
  inflight = fetch(SECTIONS_URL)
    .then((response) => response.json() as Promise<Sections>)
    .then((data) => {
      cached = data
      return data
    })
    .finally(() => {
      inflight = undefined
    })
  return inflight
}

const useSections = (): Sections | undefined => {
  const [sections, setSections] = useState<Sections | undefined>(cached)

  useEffect(() => {
    if (cached) {
      return
    }
    let isStale = false
    fetchSections()
      .then((next) => {
        if (!isStale) {
          setSections(next)
        }
      })
      .catch((error) => {
        console.warn('[useSections] fetch failed:', error)
      })
    return () => {
      isStale = true
    }
  }, [])

  return sections
}

export default useSections
