import {
  BYTE_MASK,
  COLOR_CHANNEL_MAX,
  DESTINATION_MARKER_COLOR,
  FULL_MAP_LEFT,
  FULL_MAP_MARKER_SIZE,
  FULL_MAP_TOP,
  VEHICLE_MARKER_PULSE_START,
  VEHICLE_MARKER_PULSE_STEP,
} from '../../../constants'
import { createFlatRectsGeometry, createPsxMaterial, createRect } from '../../psxPrimitives'
import { MapPixel } from '../fullMapUtils'

export const createMarkersGeometry = (markers: readonly MapPixel[]) =>
  createFlatRectsGeometry(
    markers.map(({ x, y }) =>
      createRect(FULL_MAP_LEFT + x, FULL_MAP_TOP + y, FULL_MAP_MARKER_SIZE, FULL_MAP_MARKER_SIZE),
    ),
  )

export const convertChannelToModulation = (channel: number) => channel / COLOR_CHANNEL_MAX

export const createDestinationMaterial = () => {
  const material = createPsxMaterial('opaque')
  const [red, green, blue] = DESTINATION_MARKER_COLOR.map(convertChannelToModulation)
  material.uniforms.modulation.value.set(red, green, blue)
  return material
}

export const createVehicleMaterial = () => {
  const material = createPsxMaterial('opaque')
  material.uniforms.modulation.value.set(0, 0, 0)
  return material
}

export const calculateVehicleMarkerRed = (frame: number) =>
  (VEHICLE_MARKER_PULSE_START - VEHICLE_MARKER_PULSE_STEP * frame) & BYTE_MASK
