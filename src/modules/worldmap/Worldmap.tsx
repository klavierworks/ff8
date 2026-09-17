import { Suspense, useEffect, useLayoutEffect } from 'react'

import { MEMORY } from '../field/Scripts/Script/handlers'
import Camera from './Camera/Camera'
import Controls from './Controls/Controls'
import Effects from './Effects/Effects'
import Entities from './Entities/Entities'
import Lighting from './Lighting/Lighting'
import Location from './Location/Location'
import Minimap from './Minimap/Minimap'
import { selectIsFullMapShown } from './Minimap/minimapUtils'
import Music from './Music/Music'
import Player from './Player/Player'
import { setDialogText } from './Scripts/dialog'
import Sky from './Sky/Sky'
import Tiles from './Tiles/Tiles'
import TriggerZones from './TriggerZones/TriggerZones'
import useSections from './useSections'
import { restoreWorldmapEntryState, saveWorldmapExitState } from './worldmapPersistence'
import useWorldmapStore, { mirrorVehicleIdToGlobalStore } from './worldmapStore'

const Worldmap = () => {
  const sections = useSections()
  const isFullMapShown = useWorldmapStore(selectIsFullMapShown)

  useLayoutEffect(() => {
    restoreWorldmapEntryState(MEMORY)
    return () => {
      saveWorldmapExitState(MEMORY)
    }
  }, [])

  useEffect(() => {
    setDialogText(sections.section_13_dialog_text.dialog)
  }, [sections])

  useEffect(mirrorVehicleIdToGlobalStore, [])

  return (
    <Suspense fallback={null}>
      <Camera />
      <Controls />
      <Lighting />
      <group visible={!isFullMapShown}>
        <Tiles />
      </group>
      <Location regionLocationIds={sections.section_18_region_location_ids.region_location_ids} />
      <Music />
      <group visible={!isFullMapShown}>
        <Player landings={sections.section_8_field_landing_positions.positions} />
        <Effects />
        <Sky zones={sections.section_32_sky_color_zones.zones} />
      </group>
      <TriggerZones locationScripts={sections.section_7_player_location_scripts} />
      <group visible={!isFullMapShown}>
        <Entities
          positions={sections.section_10_entity_spawn_positions.positions}
          scripts={sections.section_9_entity_spawn_scripts}
        />
      </group>
      <Minimap />
    </Suspense>
  )
}

export default Worldmap
