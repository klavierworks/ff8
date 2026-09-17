import wm2fieldData from '@data/worldmap/wm2field.json'
import { Vector3 } from 'three'

import MAP_NAMES from '../../../constants/maps'
import { vectorToFloatingPoint } from '../../../utils'
import { ScriptSection } from '../Scripts/runScript'
import { runLocationScripts } from '../Scripts/sectionRunners'
import { buildWorldPosition } from '../worldPosition'

type FieldEntrance = (typeof wm2fieldData)[number]

type MapName = (typeof MAP_NAMES)[number]

const getMapName = (fieldId: number) => (MAP_NAMES as readonly string[])[fieldId] as MapName | undefined

const findFieldEntrance = (locationScripts: ScriptSection, characterPosition: Vector3) => {
  const entranceIndex = runLocationScripts(
    locationScripts,
    buildWorldPosition(characterPosition.x, characterPosition.z),
  )
  return entranceIndex === undefined ? undefined : wm2fieldData.at(entranceIndex)
}

const buildFieldTransition = ({ direction, x, y, z }: FieldEntrance, fieldName: MapName) => ({
  initialAngle: direction,
  module: 'field' as const,
  pendingCharacterPosition: vectorToFloatingPoint({ x, y, z }),
  pendingFieldId: fieldName,
})

export const findFieldTransition = (locationScripts: ScriptSection, characterPosition: Vector3) => {
  const entrance = findFieldEntrance(locationScripts, characterPosition)
  if (!entrance) {
    return undefined
  }
  const fieldName = getMapName(entrance.fieldId)
  if (!fieldName) {
    return undefined
  }
  return buildFieldTransition(entrance, fieldName)
}
