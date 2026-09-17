import { Suspense, useEffect, useLayoutEffect, useMemo } from 'react'

import { MEMORY } from '../field/Scripts/Script/handlers'
import Camera from './Camera/Camera'
import Controls from './Controls/Controls'
import Director from './Director/Director'
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
import Trains from './Trains/Trains'
import useSections from './useSections'
import VehicleSounds from './VehicleSounds/VehicleSounds'
import { enterWorldmap, saveWorldmapExitState } from './worldmapPersistence'
import useWorldmapStore, { mirrorVehicleIdToGlobalStore } from './worldmapStore'

const Worldmap = () => {
  const sections = useSections()
  const isFullMapShown = useWorldmapStore(selectIsFullMapShown)
  const trainStations = useMemo(
    () => ({
      cameraGroups: sections.section_17_ride_camera_tracks.groups,
      exits: sections.section_12_train_exit_positions.positions,
      scripts: sections.section_11_vehicle_warp_scripts,
    }),
    [sections],
  )

  useLayoutEffect(() => {
    enterWorldmap(
      MEMORY,
      sections.section_8_field_landing_positions.positions,
      sections.section_17_ride_camera_tracks.groups,
    )
    return () => {
      saveWorldmapExitState(MEMORY)
    }
  }, [sections])

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
      <VehicleSounds />
      <group visible={!isFullMapShown}>
        <Player />
        <Trains />
        <Effects />
        <Sky zones={sections.section_32_sky_color_zones.zones} />
      </group>
      <Director
        eventScripts={sections.section_36_event_scripts}
        locationScripts={sections.section_7_player_location_scripts}
        trainStations={trainStations}
      />
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
