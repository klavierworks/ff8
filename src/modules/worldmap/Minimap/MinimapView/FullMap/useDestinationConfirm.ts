import { RefObject, useEffect, useRef } from 'react'

import { WORLDMAP_PAD_BITS } from '../../../../../constants/controls'
import { VEHICLE_IDS } from '../../../../../constants/vehicles'
import {
  AUTOPILOT_CONFIRM_SLOT,
  AUTOPILOT_CONFIRM_SUFFIX_STRING_ID,
  AUTOPILOT_CONFIRM_YES,
} from '../../../../../constants/worldmapAutopilot'
import { getPadPresses } from '../../../Controls/padPresses'
import { AutopilotTarget, setAutopilot } from '../../../Player/FlyingRagnarok/ragnarokState'
import { DIALOG_STATE_PENDING, EVENT_CHOICE_OPTIONS } from '../../../Scripts/constants'
import { closeDialog, getSlotState, isDialogActive, showDialogText } from '../../../Scripts/dialog'
import useScriptTick from '../../../useScriptTick'
import useSections from '../../../useSections'
import useWorldmapStore, { WORLD_MAP_STATE_AUTOPILOT } from '../../../worldmapStore'
import { MINIMAP_MODE_PLANET } from '../../constants'
import { MapCell } from '../../minimapUtils'
import { calculateConfirmPlacement, ConfirmRequest, createConfirmRequest } from './destinationConfirmUtils'
import { LabelState } from './locationLabelUtils'

const isConfirmPressed = (tick: number) => (getPadPresses(tick) & WORLDMAP_PAD_BITS.confirm) !== 0

const isAboardRagnarok = () => useWorldmapStore.getState().vehicleId === VEHICLE_IDS.RAGNAROK

const startAutopilot = (target: AutopilotTarget) => {
  setAutopilot(target)
  useWorldmapStore.setState({ minimapMode: MINIMAP_MODE_PLANET, worldMapState: WORLD_MAP_STATE_AUTOPILOT })
}

const openConfirmWindow = ({ text }: ConfirmRequest) => {
  showDialogText(AUTOPILOT_CONFIRM_SLOT, text, calculateConfirmPlacement(text), EVENT_CHOICE_OPTIONS)
}

const useDestinationConfirm = (cursorRef: RefObject<MapCell>, labelRef: RefObject<LabelState>) => {
  const sections = useSections()
  const pendingTargetRef = useRef<AutopilotTarget | null>(null)

  useEffect(() => () => closeDialog(AUTOPILOT_CONFIRM_SLOT), [])

  useScriptTick(
    (tick) => {
      const choice = getSlotState(AUTOPILOT_CONFIRM_SLOT)
      if (choice !== DIALOG_STATE_PENDING) {
        closeDialog(AUTOPILOT_CONFIRM_SLOT)
        if (choice === AUTOPILOT_CONFIRM_YES && pendingTargetRef.current) {
          startAutopilot(pendingTargetRef.current)
        }
        pendingTargetRef.current = null
        return
      }
      if (isDialogActive(AUTOPILOT_CONFIRM_SLOT) || !isConfirmPressed(tick) || !isAboardRagnarok()) {
        return
      }
      const request = createConfirmRequest(labelRef.current, cursorRef.current, {
        names: sections.section_31_location_names.location_names,
        records: sections.section_30_animation_descriptors.records,
        suffix: sections.section_13_dialog_text.dialog[AUTOPILOT_CONFIRM_SUFFIX_STRING_ID] ?? '',
      })
      if (!request) {
        return
      }
      pendingTargetRef.current = request.target
      openConfirmWindow(request)
    },
    { shouldSkipMountTick: true },
  )
}

export default useDestinationConfirm
