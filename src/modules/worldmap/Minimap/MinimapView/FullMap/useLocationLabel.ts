import { RefObject, useEffect, useRef } from 'react'

import { closeMessage, openMessage } from '../../../../field/Scripts/Script/utils'
import useScriptTick from '../../../useScriptTick'
import useSections from '../../../useSections'
import { MapCell } from '../../minimapUtils'
import { findLocationIdAtCell } from './fullMapUtils'
import {
  calculateLabelPlacement,
  decideLabelAction,
  getLabelMessageId,
  getNextLabelState,
  INITIAL_LABEL_STATE,
} from './locationLabelUtils'

const useLocationLabel = (cursorRef: RefObject<MapCell>) => {
  const sections = useSections()
  const labelRef = useRef(INITIAL_LABEL_STATE)
  const messageCountRef = useRef(0)

  useEffect(() => () => closeMessage(getLabelMessageId(messageCountRef.current)), [])

  useScriptTick(
    () => {
      const records = sections.section_30_animation_descriptors.records
      const names = sections.section_31_location_names.location_names
      const locationId = findLocationIdAtCell(sections.section_7_player_location_scripts, cursorRef.current)
      const action = decideLabelAction(labelRef.current, locationId, records, names)
      if (action.kind !== 'keep' && labelRef.current.isOpen) {
        closeMessage(getLabelMessageId(messageCountRef.current))
      }
      if (action.kind === 'open') {
        messageCountRef.current += 1
        openMessage(
          getLabelMessageId(messageCountRef.current),
          [action.name],
          calculateLabelPlacement(action.name),
          false,
        )
      }
      labelRef.current = getNextLabelState(labelRef.current, action, locationId)
    },
    { shouldSkipMountTick: true },
  )
}

export default useLocationLabel
