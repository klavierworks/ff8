import { Vector3 } from 'three'

import { numberToFloatingPoint } from '../../../../../utils'
import { radiansToUnit } from '../RotationController/rotationUtils'
import { isValidActionableMethod } from '../utils'
import { InteractiveEntity } from './modelUtils'

const PUSH_HEIGHT_LIMIT = numberToFloatingPoint(128)
const TALK_HEIGHT_LIMIT = numberToFloatingPoint(256)

// Angles run 0-255 over a full turn, so this is a quarter turn either side.
const MAXIMUM_FACING_OFFSET = 64

const getPlanarDistance = (from: Vector3, to: Vector3) => Math.hypot(to.x - from.x, to.y - from.y)

const getHeightDifference = (from: Vector3, to: Vector3) => Math.abs(to.z - from.z)

export const hasScriptMethod = (entity: InteractiveEntity, methodId: string) =>
  isValidActionableMethod(entity.scriptController.script.methods.find((method) => method.methodId === methodId))

export const isWithinPushRange = (entity: InteractiveEntity, position: Vector3, pushRadius: number) => {
  if (getHeightDifference(position, entity.position) >= PUSH_HEIGHT_LIMIT) {
    return false
  }
  return getPlanarDistance(position, entity.position) < numberToFloatingPoint((pushRadius + entity.pushRadius) / 2)
}

const isWithinTalkRange = (entity: InteractiveEntity, position: Vector3, pushRadius: number) => {
  if (getHeightDifference(position, entity.position) >= TALK_HEIGHT_LIMIT) {
    return false
  }
  return getPlanarDistance(position, entity.position) < numberToFloatingPoint(pushRadius + entity.talkRadius)
}

const getAngleTo = (from: Vector3, to: Vector3) => (radiansToUnit(Math.atan2(to.x - from.x, from.y - to.y)) + 256) % 256

const getFacingOffset = (entity: InteractiveEntity, position: Vector3, angle: number) => {
  const offset = (((angle - getAngleTo(position, entity.position)) % 256) + 256) % 256
  return offset > 128 ? 256 - offset : offset
}

export const findTalkTarget = (entities: InteractiveEntity[], position: Vector3, angle: number, pushRadius: number) => {
  const inRange = entities.filter(
    (entity) => entity.isTalkable && hasScriptMethod(entity, 'talk') && isWithinTalkRange(entity, position, pushRadius),
  )

  const [closest] = inRange
    .map((entity) => ({ entity, facingOffset: getFacingOffset(entity, position, angle) }))
    .filter(({ facingOffset }) => facingOffset < MAXIMUM_FACING_OFFSET)
    .sort((a, b) => a.facingOffset - b.facingOffset)

  return closest?.entity
}
