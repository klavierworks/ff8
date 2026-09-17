import wm2fieldData from '@data/worldmap/wm2field.json'

import MAP_NAMES from '../../constants/maps'
import { CURRENT_CAR_RENT_ADDRESS } from '../../constants/worldmapTransitions'
import useGlobalStore from '../../store'
import { getGatewayDestination } from '../../utils'
import { awaitFadesync, triggerFadeout } from '../field/Scripts/Script/common'
import { MEMORY } from '../field/Scripts/Script/handlers'
import { isLocationTriggerSet } from './Scripts/state'
import { saveWorldmapExitState } from './worldmapPersistence'
import { writeSavedLocationTriggerBit } from './worldmapSaveData'
import useWorldmapStore from './worldmapStore'

type FieldEntrance = (typeof wm2fieldData)[number]

const buildFieldArrival = ({ direction, fieldId, x, y, z }: FieldEntrance) => {
  const fieldName = MAP_NAMES[fieldId]
  if (!fieldName) {
    return undefined
  }
  const destination = getGatewayDestination({ x, y, z })
  return {
    initialAngle: direction,
    module: 'field' as const,
    pendingCharacterPosition: destination.position,
    pendingCharacterTriangle: destination.triangle,
    pendingFieldId: fieldName,
  }
}

export const leaveWorldmapToField = async (entranceIndex: number) => {
  const entrance = wm2fieldData.at(entranceIndex)
  const arrival = entrance && buildFieldArrival(entrance)
  if (!arrival || useWorldmapStore.getState().isExiting) {
    return
  }
  useWorldmapStore.setState({ isExiting: true })
  MEMORY[CURRENT_CAR_RENT_ADDRESS] = useWorldmapStore.getState().vehicleId
  writeSavedLocationTriggerBit(MEMORY, isLocationTriggerSet())
  saveWorldmapExitState(MEMORY)
  triggerFadeout()
  await awaitFadesync()
  useGlobalStore.setState(arrival)
}
