import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { WORLDMAP_ENTRY_FROM_BATTLE } from '../../../constants/worldmapTransitions'
import useGlobalStore from '../../../store'
import { EventOutcome } from '../Scripts/eventActions'
import { ScriptSection } from '../Scripts/runScript'
import { advanceScriptInputs } from '../Scripts/scriptInputs'
import { runTrainStations, TrainStations } from '../Trains/trainStations'
import useScriptTick from '../useScriptTick'
import { getEntryDelayFrames } from '../worldmapEntry'
import { leaveWorldmapToField } from '../worldmapExit'
import useWorldmapStore from '../worldmapStore'
import { buildWorldPosition } from '../worldPosition'
import { fadeInWorldmap, findDirectorOutcome, isDirectorPaused, playWorldmapBattle } from './directorUtils'

type DirectorProps = {
  eventScripts: ScriptSection
  locationScripts: ScriptSection
  trainStations: TrainStations
}

const _previousPosition = new Vector3()

const Director = ({ eventScripts, locationScripts, trainStations }: DirectorProps) => {
  const entryDelayRef = useRef(getEntryDelayFrames(useWorldmapStore.getState().entryMode))
  const hasPreviousPositionRef = useRef(false)

  useEffect(() => {
    fadeInWorldmap(entryDelayRef.current)
  }, [])

  const handleOutcome = (outcome: EventOutcome) => {
    if (outcome.kind === 'field') {
      leaveWorldmapToField(outcome.entranceIndex)
      return
    }
    playWorldmapBattle(outcome.encounterId).then(() => {
      entryDelayRef.current = getEntryDelayFrames(WORLDMAP_ENTRY_FROM_BATTLE)
    })
  }

  useScriptTick(
    () => {
      const { characterPosition } = useGlobalStore.getState()
      if (!characterPosition) {
        return
      }
      advanceScriptInputs(
        useWorldmapStore.getState().controls.padButtons,
        characterPosition,
        hasPreviousPositionRef.current ? _previousPosition : undefined,
      )
      _previousPosition.copy(characterPosition)
      hasPreviousPositionRef.current = true

      if (entryDelayRef.current > 0) {
        entryDelayRef.current -= 1
        return
      }
      if (isDirectorPaused()) {
        return
      }
      const position = buildWorldPosition(characterPosition.x, characterPosition.z)
      const outcome = findDirectorOutcome({ eventScripts, locationScripts }, position)
      if (outcome) {
        handleOutcome(outcome)
        return
      }
      runTrainStations(trainStations, position)
    },
    { shouldSkipMountTick: true },
  )

  return null
}

export default Director
