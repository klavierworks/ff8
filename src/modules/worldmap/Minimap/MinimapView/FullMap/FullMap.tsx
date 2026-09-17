import { useEffect, useMemo } from 'react'

import useSections from '../../../useSections'
import {
  BACKDROP_RENDER_ORDER,
  FULL_MAP_LEFT,
  FULL_MAP_TOP,
  MAP_PIXELS_PER_CELL,
  MAP_RENDER_ORDER,
} from '../../constants'
import CharaPointer from '../CharaPointer/CharaPointer'
import { createPsxMaterial } from '../psxPrimitives'
import { MinimapTextures } from '../useMinimapTextures'
import {
  collectVehicleMarkers,
  createBackdropGeometry,
  createBackdropMaterial,
  createMapGeometry,
  findDestinationMarkers,
} from './fullMapUtils'
import MapCursor from './MapCursor/MapCursor'
import MapMarkers from './MapMarkers/MapMarkers'
import useFullMapCursor from './useFullMapCursor'
import useLocationLabel from './useLocationLabel'

type FullMapProps = {
  textures: MinimapTextures
}

const FullMap = ({ textures }: FullMapProps) => {
  const sections = useSections()

  const destinations = useMemo(
    () =>
      findDestinationMarkers(
        sections.section_30_animation_descriptors.records,
        sections.section_31_location_names.location_names,
        sections.section_7_player_location_scripts,
      ),
    [sections],
  )
  const vehicles = useMemo(collectVehicleMarkers, [])
  const cursorRef = useFullMapCursor(destinations)
  useLocationLabel(cursorRef)

  const backdropGeometry = useMemo(createBackdropGeometry, [])
  const backdropMaterial = useMemo(createBackdropMaterial, [])
  const mapGeometry = useMemo(createMapGeometry, [])
  const mapMaterial = useMemo(() => createPsxMaterial('opaque', textures.colorMap), [textures.colorMap])

  useEffect(
    () => () => {
      backdropGeometry.dispose()
      mapGeometry.dispose()
      backdropMaterial.dispose()
    },
    [backdropGeometry, mapGeometry, backdropMaterial],
  )
  useEffect(() => () => mapMaterial.dispose(), [mapMaterial])

  return (
    <>
      <mesh
        frustumCulled={false}
        geometry={backdropGeometry}
        material={backdropMaterial}
        renderOrder={BACKDROP_RENDER_ORDER}
      />
      <mesh frustumCulled={false} geometry={mapGeometry} material={mapMaterial} renderOrder={MAP_RENDER_ORDER} />
      <MapMarkers destinations={destinations} vehicles={vehicles} />
      <CharaPointer
        cellScale={MAP_PIXELS_PER_CELL}
        isNeedleAlwaysShown
        originX={FULL_MAP_LEFT}
        originY={FULL_MAP_TOP}
        textures={textures}
      />
      <MapCursor cursorRef={cursorRef} texture={textures.cursor} />
    </>
  )
}

export default FullMap
