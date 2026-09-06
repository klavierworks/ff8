import { useMemo, useState } from 'react'

import { Script } from '../../types'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'
import { Side } from '../useIntersection'
import DoorLine from './DoorLine/DoorLine'

type DoorProps = {
  doors: Door[]
  script: Script
  scriptController: ReturnType<typeof createScriptController>
  useScriptStateStore: ScriptStateStore
}

const Door = ({ doors, script, scriptController, useScriptStateStore }: DoorProps) => {
  const isDoorOn = useScriptStateStore((state) => state.isDoorOn)

  const [isDoorOpen, setIsDoorOpen] = useState(false)

  const doorLines = useMemo(() => {
    const entries = doors.filter((door) => door.name === script.name)
    if (entries.length === 0) {
      console.warn(`Door with name ${script.name} not found in doors array.`)
    }
    return entries
  }, [doors, script.name])

  const [playerOpenedFromSide, setPlayerOpenedFromSide] = useState<Side>()
  const handleIntersect = async (entrySide: Side) => {
    if (playerOpenedFromSide) {
      return
    }
    setPlayerOpenedFromSide(entrySide)
    await scriptController.triggerMethod('open')
    console.log(`Door ${script.name} opened from side: ${entrySide}`)
    setIsDoorOpen(true)
  }

  const handleExit = async (entrySide: Side) => {
    // // I feel like I saw the doors close in game? There's a whole 6 types of doors in the engine (based on the mode flag on the door)
    // but all doors in the field are 0, ie: "open only". This feels like I'm missing something – nearly all doors have a 'close' script
    return

    if (entrySide !== playerOpenedFromSide) {
      return
    }
    setPlayerOpenedFromSide(undefined)
    setIsDoorOpen(false)
    console.log(`Door ${script.name} closed from side: ${entrySide}`)
    await scriptController.triggerMethod('close')
  }

  return (
    <>
      {doorLines.map((door, index) => (
        <DoorLine
          door={door}
          isDoorOn={isDoorOn}
          isDoorOpen={isDoorOpen}
          key={`${door.name}-${index}`}
          onTouchOff={handleExit}
          onTouchOn={handleIntersect}
        />
      ))}
    </>
  )
}

export default Door
