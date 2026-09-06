import { useCallback } from 'react'

import MAP_NAMES from '../../../constants/maps.ts'
import useGlobalStore from '../../../store.ts'
import { FieldData } from '../Field.tsx'
import Gateway from './Gateway/Gateway.tsx'

type GatewaysProps = {
  gateways: FieldData['gateways']
}

const Gateways = ({ gateways }: GatewaysProps) => {
  const isTransitioningMap = useGlobalStore((state) => !!state.pendingFieldId)

  const handleTransition = useCallback(
    (gateway: FormattedGateway) => {
      if (isTransitioningMap) {
        return
      }

      useGlobalStore.setState({
        pendingCharacterPosition: gateway.destination,
        pendingCharacterTriangle: gateway.destinationTriangle,
        pendingFieldId: gateway.target as (typeof MAP_NAMES)[number],
      })
    },
    [isTransitioningMap],
  )

  if (isTransitioningMap) {
    return null
  }

  return (
    <>
      {gateways.map((gateway, index) => (
        <Gateway gateway={gateway} key={`${gateway.target}-${index}`} onIntersect={handleTransition} />
      ))}
    </>
  )
}

export default Gateways
