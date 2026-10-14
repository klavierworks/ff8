import { CSSProperties, PointerEvent } from 'react'
import { Vector2 } from 'three'

import {
  CONTROLS_MAP,
  TOUCH_STICK_DEADZONE,
  TOUCH_STICK_RADIUS,
  TOUCH_STICK_SECTOR_HYSTERESIS,
  TOUCH_STICK_SECTOR_KEYS,
  TOUCH_STICK_WALK_THRESHOLD,
} from '../../constants/controls'

export type ActiveStick = {
  offset: Vector2
  origin: Vector2
  pointerId: number
  sector: null | number
}

export const getLocalPoint = (event: PointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect()
  return new Vector2(event.clientX - rect.left, event.clientY - rect.top)
}

export const createActiveStick = (pointerId: number, origin: Vector2): ActiveStick => ({
  offset: new Vector2(),
  origin,
  pointerId,
  sector: null,
})

const getSectorAngle = () => (Math.PI * 2) / TOUCH_STICK_SECTOR_KEYS.length

const calculateAngularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

const calculateNearestSector = (angle: number) => {
  const sectorCount = TOUCH_STICK_SECTOR_KEYS.length
  return (Math.round(angle / getSectorAngle()) + sectorCount) % sectorCount
}

const calculateTilt = (offset: Vector2) => offset.length() / TOUCH_STICK_RADIUS

const calculateSector = (offset: Vector2, previousSector: null | number) => {
  if (calculateTilt(offset) < TOUCH_STICK_DEADZONE) {
    return null
  }
  const angle = Math.atan2(-offset.y, offset.x)
  const sectorAngle = getSectorAngle()
  if (previousSector === null) {
    return calculateNearestSector(angle)
  }
  const isWithinPreviousSector =
    calculateAngularDistance(angle, previousSector * sectorAngle) <= sectorAngle / 2 + TOUCH_STICK_SECTOR_HYSTERESIS
  return isWithinPreviousSector ? previousSector : calculateNearestSector(angle)
}

const calculateFollowedOrigin = (origin: Vector2, point: Vector2) => {
  const offset = point.clone().sub(origin)
  if (offset.length() <= TOUCH_STICK_RADIUS) {
    return origin
  }
  return point.clone().sub(offset.setLength(TOUCH_STICK_RADIUS))
}

export const calculateNextStick = (stick: ActiveStick, point: Vector2): ActiveStick => {
  const origin = calculateFollowedOrigin(stick.origin, point)
  const offset = point.clone().sub(origin)
  return { ...stick, offset, origin, sector: calculateSector(offset, stick.sector) }
}

export const getStickKeys = (stick: ActiveStick | null): ReadonlySet<string> => {
  if (!stick || stick.sector === null) {
    return new Set()
  }
  const directionKeys = TOUCH_STICK_SECTOR_KEYS[stick.sector]
  const isWalking = calculateTilt(stick.offset) < TOUCH_STICK_WALK_THRESHOLD
  return new Set(isWalking ? [...directionKeys, CONTROLS_MAP.walk] : directionKeys)
}

export const getBaseStyle = (stick: ActiveStick | null): CSSProperties | undefined =>
  stick ? { left: stick.origin.x, top: stick.origin.y } : undefined

export const getKnobStyle = (stick: ActiveStick | null): CSSProperties | undefined =>
  stick ? { translate: `${stick.offset.x}px ${stick.offset.y}px` } : undefined
