import { useMemo, useRef } from 'react'
import { Mesh } from 'three'

import useGlobalStore from '../../../store'
import { vectorToFloatingPoint } from '../../../utils'
import { FieldData } from '../../Field'
import LineBlock from '../../LineBlock/LineBlock'
import useIntersection from '../../Scripts/Script/useIntersection'

const Gateway = ({
  gateway,
  onIntersect,
}: {
  gateway: FieldData['gateways'][0]
  onIntersect: (gateway: FormattedGateway) => void
}) => {
  const lineRef = useRef<Mesh>(null)
  const formattedGateway: FormattedGateway = useMemo(() => {
    return {
      destination: vectorToFloatingPoint(gateway.destinationPoint),
      sourceLine: gateway.sourceLine.map(vectorToFloatingPoint),
      target: gateway.target,
    }
  }, [gateway])

  const isMapJumpEnabled = useGlobalStore((state) => state.isMapJumpEnabled)

  useIntersection(
    lineRef,
    isMapJumpEnabled,
    {
      onTouchOn: () => onIntersect(formattedGateway),
    },
    formattedGateway.sourceLine,
  )

  return (
    <LineBlock
      color={isMapJumpEnabled ? 'yellow' : 'black'}
      lineBlockRef={lineRef}
      points={formattedGateway.sourceLine}
      renderOrder={0}
    />
  )
}

export default Gateway
