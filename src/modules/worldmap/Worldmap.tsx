import { Html } from '@react-three/drei'
import { Suspense, useEffect } from 'react'

import useGlobalStore from '../../store'
import Camera from './Camera/Camera'
import Controls from './Controls/Controls'
import Entities from './Entities/Entities'
import Lighting from './Lighting/Lighting'
import Location from './Location/Location'
import Minimap from './Minimap/Minimap'
import Music from './Music/Music'
import { buildLandingSpotsFromSection35 } from './Player/FlyingRagnarok/landingSpots'
import Player from './Player/Player'
import { setDialogText } from './Scripts/dialog'
import Sky from './Sky/Sky'
import Tiles from './Tiles/Tiles'
import TriggerZones from './TriggerZones/TriggerZones'
import useSections from './useSections'
import useWorldmapStore from './worldmapStore'

const Worldmap = () => {
  const sections = useSections()

  useEffect(() => {
    if (sections) {
      setDialogText(sections.section_13_dialog_text.dialog)
    }
  }, [sections])

  useEffect(() => {
    if (!sections) {
      return
    }
    useWorldmapStore.setState({
      landingSpots: buildLandingSpotsFromSection35(sections.section_35_special_locations.locations),
    })
  }, [sections])

  // Mirror `useWorldmapStore.vehicleId` to the global store so cross-module
  // consumers (e.g. Tiles) can react to vehicle changes without reaching into
  // the worldmap module. The worldmap store remains the source of truth.
  useEffect(() => {
    useGlobalStore.setState({ vehicleId: useWorldmapStore.getState().vehicleId })
    return useWorldmapStore.subscribe((state, previousState) => {
      if (state.vehicleId !== previousState.vehicleId) {
        useGlobalStore.setState({ vehicleId: state.vehicleId })
      }
    })
  }, [])

  return (
    <Suspense fallback={null}>
      <Camera />
      <Controls />
      <Lighting />
      <Tiles />
      {sections && (
        <>
          <Location regionLocationIds={sections.section_18_region_location_ids.region_location_ids} />
          <Music />
          <Player landings={sections.section_8_field_landing_positions.positions} />
          <Sky zones={sections.section_32_sky_color_zones.zones} />
          <TriggerZones playerLocationScripts={sections.section_7_player_location_scripts} />
          <Entities
            positions={sections.section_10_entity_spawn_positions.positions}
            scripts={sections.section_9_entity_spawn_scripts}
          />
        </>
      )}
      <Html calculatePosition={(_el, _camera, size) => [size.width / 2, size.height / 2]} fullscreen>
        <Minimap />
      </Html>
    </Suspense>
  )
}

export default Worldmap
