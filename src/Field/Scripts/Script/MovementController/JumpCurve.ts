import { Vector3 } from 'three'

const GRAVITY_CONSTANT = -0.0006

class JumpCurve {
  duration: number
  end: Vector3
  initialVelocityX: number

  initialVelocityY: number
  initialVelocityZ: number
  start: Vector3

  constructor(start: Vector3, end: Vector3, duration: number) {
    this.start = start
    this.end = end
    this.duration = duration

    const displacement = end.clone().sub(start)

    this.initialVelocityZ = (displacement.z - 0.5 * GRAVITY_CONSTANT * duration * duration) / duration
    this.initialVelocityX = displacement.x / duration
    this.initialVelocityY = displacement.y / duration
  }

  getPointAt(progress: number) {
    const t = progress * this.duration
    return this.getPositionAtTime(t)
  }

  getPositionAtTime(t: number) {
    const x = this.start.x + this.initialVelocityX * t
    const y = this.start.y + this.initialVelocityY * t
    const z = this.start.z + this.initialVelocityZ * t + 0.5 * GRAVITY_CONSTANT * t * t
    return new Vector3(x, y, z)
  }
}

export default JumpCurve
