import { useCallback } from 'react'

import MAP_NAMES from '../../../constants/maps.ts'
import { WORLDMAP_GATEWAY_VEHICLE } from '../../../constants/worldmapTransitions.ts'
import useGlobalStore from '../../../store.ts'
import { FieldData } from '../Field.tsx'
import { jumpToWorldmap } from '../worldmapJump.ts'
import Gateway from './Gateway/Gateway.tsx'

type GatewaysProps = {
  gateways: FieldData['gateways']
}

const getTargetFieldIndex = (gateway: FormattedGateway) =>
  MAP_NAMES.indexOf(gateway.target as (typeof MAP_NAMES)[number])

const isWorldmapGateway = (gateway: FormattedGateway) => gateway.target.startsWith('wm')

const Gateways = ({ gateways }: GatewaysProps) => {
  const isTransitioningMap = useGlobalStore((state) => !!state.pendingFieldId)

  const handleTransition = useCallback(
    (gateway: FormattedGateway) => {
      if (isTransitioningMap) {
        return
      }

      if (isWorldmapGateway(gateway)) {
        useGlobalStore.setState({ isPlayerInputBlocked: true })
        jumpToWorldmap({
          rideDestinationEntrance: gateway.direction,
          spawnPointId: getTargetFieldIndex(gateway),
          vehicleId: WORLDMAP_GATEWAY_VEHICLE,
        })
        return
      }

      useGlobalStore.setState({
        initialAngle: gateway.direction,
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
