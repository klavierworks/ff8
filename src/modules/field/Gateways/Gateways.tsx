import { useCallback, useMemo } from 'react'

import MAP_NAMES from '../../../constants/maps.ts'
import generatedGateways from '../../../gateways.ts'
import useGlobalStore from '../../../store.ts'
import Gateway from './Gateway/Gateway.tsx'

type GatewaysProps = {
  fieldId: string
}

const Gateways = ({ fieldId }: GatewaysProps) => {
  const isTransitioningMap = useGlobalStore((state) => !!state.pendingFieldId)

  const handleTransition = useCallback(
    (gateway: FormattedGateway) => {
      if (isTransitioningMap) {
        return
      }

      useGlobalStore.setState({
        pendingCharacterPosition: gateway.destination,
        pendingFieldId: gateway.target as (typeof MAP_NAMES)[number],
      })
    },
    [isTransitioningMap],
  )

  const gateways = useMemo(() => {
    return generatedGateways.filter((gateway) => gateway.source === fieldId) as unknown as Gateway[]
  }, [fieldId])

  if (isTransitioningMap) {
    return null
  }

  return (
    <>
      {gateways.map((gateway) => (
        <Gateway gateway={gateway} key={gateway.id} onIntersect={handleTransition} />
      ))}
    </>
  )
}

export default Gateways
