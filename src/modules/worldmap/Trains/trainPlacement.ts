import { Object3D, PerspectiveCamera, Vector3 } from 'three'

import { calculateCurvedEntityY } from '../curvature'
import { psxXToWorld, psxZToWorld } from '../Player/playerUtils'
import { psxHeightToWorldY } from '../terrain'
import { PsxVector, RideCameraView } from './rideCamera'
import { Train } from './trainSimulation'

const _position = new Vector3()
const _neighbour = new Vector3()
const _direction = new Vector3()
const _eye = new Vector3()
const _target = new Vector3()

export const setWorldFromRailPoint = (target: Vector3, point: PsxVector) =>
  target.set(psxXToWorld(point.x), psxHeightToWorldY(point.altitude), psxZToWorld(-point.z))

// Each drawn car turns towards the car it is linked to, so the two end cars face outward.
export const placeTrainCar = (object: Object3D, train: Train, carIndex: number) => {
  const car = train.cars[carIndex]
  const link = train.links[carIndex] ?? 0
  const neighbour = train.cars[carIndex + link]
  if (!car || !neighbour || link === 0) {
    return
  }
  setWorldFromRailPoint(_position, car)
  setWorldFromRailPoint(_neighbour, neighbour)
  _direction.subVectors(_neighbour, _position)
  object.position.set(_position.x, calculateCurvedEntityY(_position), _position.z)
  object.rotation.set(
    0,
    -Math.atan2(_direction.z, _direction.x) - Math.PI,
    -Math.atan2(_direction.y, Math.hypot(_direction.x, _direction.z)),
    'YZX',
  )
}

export const placeRideCamera = (camera: PerspectiveCamera, view: RideCameraView) => {
  setWorldFromRailPoint(_eye, view.eye)
  setWorldFromRailPoint(_target, view.target)
  camera.position.copy(_eye)
  camera.lookAt(_target)
  camera.updateMatrixWorld()
}
