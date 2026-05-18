import { useMemo, useRef, useState } from 'react'
import { Mesh } from 'three'

import { vectorToFloatingPoint } from '../../../../../utils'
import LineBlock from '../../../LineBlock/LineBlock'
import { Script } from '../../types'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'
import useIntersection, { Side } from '../useIntersection'

type DoorProps = {
  doors: Door[]
  script: Script
  scriptController: ReturnType<typeof createScriptController>
  useScriptStateStore: ScriptStateStore
}

const Door = ({ doors, script, scriptController, useScriptStateStore }: DoorProps) => {
  const isDoorOn = useScriptStateStore((state) => state.isDoorOn)

  const [isDoorOpen, setIsDoorOpen] = useState(false)

  const door = useMemo(() => {
    const entry = doors.find((door) => door.name === script.name)!
    if (!entry) {
      console.warn(`Door with name ${script.name} not found in doors array.`)
    }
    return entry
  }, [doors, script.name])

  const hitboxRef = useRef<Mesh>(null)

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
    if (entrySide !== playerOpenedFromSide) {
      return
    }
    setPlayerOpenedFromSide(undefined)
    setIsDoorOpen(false)
    console.log(`Door ${script.name} closed from side: ${entrySide}`)
    await scriptController.triggerMethod('close')
  }

  const linePoints = useMemo(() => door && door.line.map(vectorToFloatingPoint), [door])

  useIntersection(
    isDoorOn,
    {
      onTouchOff: handleExit,
      onTouchOn: handleIntersect,
    },
    linePoints,
  )

  if (!linePoints || !isDoorOn) {
    return null
  }

  return (
    <LineBlock
      color={isDoorOpen ? 'green' : 'red'}
      lineBlockRef={hitboxRef}
      name={`door-${script.name}`}
      points={linePoints}
      userData={{
        isSolid: !isDoorOpen,
      }}
    />
  )
}

export default Door
