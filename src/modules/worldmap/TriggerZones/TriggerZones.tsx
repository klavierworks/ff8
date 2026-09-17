import { useRef } from 'react'
import { Vector3 } from 'three'

import useGlobalStore from '../../../store'
import { LOCATION_SCRIPT_ENTRY_DELAY_FRAMES } from '../Scripts/constants'
import { ScriptSection } from '../Scripts/runScript'
import { advanceScriptInputs } from '../Scripts/scriptInputs'
import useScriptTick from '../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../worldmapStore'
import { findFieldTransition } from './triggerZonesUtils'

type TriggerZonesProps = {
  locationScripts: ScriptSection
}

const _previousPosition = new Vector3()

const TriggerZones = ({ locationScripts }: TriggerZonesProps) => {
  const entryDelayRef = useRef(LOCATION_SCRIPT_ENTRY_DELAY_FRAMES)
  const hasPreviousPositionRef = useRef(false)

  useScriptTick(
    () => {
      const { characterPosition, pendingFieldId } = useGlobalStore.getState()
      if (!characterPosition) {
        return
      }
      const { controls, worldMapState } = useWorldmapStore.getState()
      advanceScriptInputs(
        controls.padButtons,
        characterPosition,
        hasPreviousPositionRef.current ? _previousPosition : undefined,
      )
      _previousPosition.copy(characterPosition)
      hasPreviousPositionRef.current = true

      if (entryDelayRef.current > 0) {
        entryDelayRef.current -= 1
        return
      }
      if (pendingFieldId || worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
        return
      }

      const transition = findFieldTransition(locationScripts, characterPosition)
      if (transition) {
        useGlobalStore.setState(transition)
      }
    },
    { shouldSkipMountTick: true },
  )

  return null
}

export default TriggerZones
