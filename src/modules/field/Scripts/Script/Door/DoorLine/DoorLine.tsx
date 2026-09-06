import { useMemo, useRef } from 'react'
import { Mesh } from 'three'

import { vectorToFloatingPoint } from '../../../../../../utils'
import LineBlock from '../../../../LineBlock/LineBlock'
import useIntersection, { Side } from '../../useIntersection'

type DoorLineProps = {
  door: Door
  isDoorOn: boolean
  isDoorOpen: boolean
  onTouchOff: (entrySide: Side) => void
  onTouchOn: (entrySide: Side) => void
}

const DoorLine = ({ door, isDoorOn, isDoorOpen, onTouchOff, onTouchOn }: DoorLineProps) => {
  const hitboxRef = useRef<Mesh>(null)

  const linePoints = useMemo(() => door.line.map(vectorToFloatingPoint), [door])

  useIntersection(
    isDoorOn,
    {
      onTouchOff,
      onTouchOn,
    },
    linePoints,
    { shouldRequireFacing: true },
  )

  if (!isDoorOn) {
    return null
  }

  return (
    <LineBlock
      color={isDoorOpen ? 'green' : 'red'}
      lineBlockRef={hitboxRef}
      name={`door-${door.name}`}
      points={linePoints}
      userData={{
        isSolid: !isDoorOpen,
      }}
    />
  )
}

export default DoorLine
