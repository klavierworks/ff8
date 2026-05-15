import { Camera, Object3D, Raycaster, Vector3 } from 'three'

import { FieldData } from './Field/Field'
import gateways from './gateways.ts'

export const numberToFloatingPoint = (value: number) => value / 4096

export const floatingPointToNumber = (value: number) => value * 4096

export const vectorToFloatingPoint = (value: number[] | Vector3 | { x: number; y: number; z: number }) => {
  if (Array.isArray(value)) {
    return new Vector3(
      numberToFloatingPoint(value[0]),
      numberToFloatingPoint(value[1]),
      numberToFloatingPoint(value[2]),
    )
  }
  const vector = new Vector3()
  vector.x = numberToFloatingPoint(value.x)
  vector.y = numberToFloatingPoint(value.y)
  vector.z = numberToFloatingPoint(value.z)

  return vector
}

export const WORLD_DIRECTIONS = {
  FORWARD: new Vector3(0, 0, -1),
  RIGHT: new Vector3(1, 0, 0),
  UP: new Vector3(0, 1, 0),
}

export const getInitialField = () => {
  const initialField = new URLSearchParams(window.location.search).get('field')

  return initialField
}

export const getInitialEntrance = (initialField: FieldData) => {
  const entrances = gateways.filter((gateway) => gateway.target === initialField.id)

  if (entrances.length === 0) {
    console.warn('No entrances found for this map... ')
    return new Vector3(0, 0, 0)
  }

  const entrance = entrances[0].destinationPoint
  return vectorToFloatingPoint(entrance)
}

const intersectionRaycaster = new Raycaster()
export const checkForIntersections = (object: Object3D, target: Vector3, blockages: Object3D[], camera: Camera) => {
  const needlePosition = new Vector3()
  object.getWorldPosition(needlePosition)
  const direction = new Vector3().subVectors(target, needlePosition).normalize()
  intersectionRaycaster.set(needlePosition, direction)
  intersectionRaycaster.far = needlePosition.distanceTo(target)
  intersectionRaycaster.near = 0
  intersectionRaycaster.camera = camera
  const intersects = intersectionRaycaster.intersectObjects(blockages, false)

  return intersects.length === 0
}
