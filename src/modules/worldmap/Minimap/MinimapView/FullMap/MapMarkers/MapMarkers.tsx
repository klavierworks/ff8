import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import { getScriptFrame } from '../../../../../field/scriptClock'
import { MARKERS_RENDER_ORDER } from '../../../constants'
import { MapPixel } from '../fullMapUtils'
import {
  calculateVehicleMarkerRed,
  convertChannelToModulation,
  createDestinationMaterial,
  createMarkersGeometry,
  createVehicleMaterial,
} from './mapMarkersUtils'

type MapMarkersProps = {
  destinations: readonly MapPixel[]
  vehicles: readonly MapPixel[]
}

const MapMarkers = ({ destinations, vehicles }: MapMarkersProps) => {
  const destinationGeometry = useMemo(() => createMarkersGeometry(destinations), [destinations])
  const vehicleGeometry = useMemo(() => createMarkersGeometry(vehicles), [vehicles])
  const destinationMaterial = useMemo(createDestinationMaterial, [])
  const vehicleMaterial = useMemo(createVehicleMaterial, [])

  useEffect(() => () => destinationGeometry.dispose(), [destinationGeometry])
  useEffect(() => () => vehicleGeometry.dispose(), [vehicleGeometry])
  useEffect(
    () => () => {
      destinationMaterial.dispose()
      vehicleMaterial.dispose()
    },
    [destinationMaterial, vehicleMaterial],
  )

  useFrame(() => {
    const red = convertChannelToModulation(calculateVehicleMarkerRed(getScriptFrame()))
    vehicleMaterial.uniforms.modulation.value.setX(red)
  })

  return (
    <>
      <mesh
        frustumCulled={false}
        geometry={vehicleGeometry}
        material={vehicleMaterial}
        renderOrder={MARKERS_RENDER_ORDER}
      />
      <mesh
        frustumCulled={false}
        geometry={destinationGeometry}
        material={destinationMaterial}
        renderOrder={MARKERS_RENDER_ORDER}
      />
    </>
  )
}

export default MapMarkers
