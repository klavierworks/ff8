import {  useCallback, useMemo } from "react"
import Gateway from "./Gateway/Gateway"
import useGlobalStore from '../../store';
import generatedGateways from '../../gateways.ts';
import MAP_NAMES from "../../constants/maps.ts";

type GatewaysProps = {
  fieldId: string,
}

const Gateways = ({ fieldId }: GatewaysProps) => {
  const isTransitioningMap = useGlobalStore(state => !!state.pendingFieldId);

  const handleTransition = useCallback((gateway: FormattedGateway) => {
    if (isTransitioningMap) {
      return;
    }

    useGlobalStore.setState({
      pendingFieldId: gateway.target as typeof MAP_NAMES[number],
      pendingCharacterPosition: gateway.destination
    });
  }, [isTransitioningMap]);

  const gateways = useMemo(() => {
    return generatedGateways.filter((gateway) => gateway.source === fieldId) as unknown as Gateway[];
  }, [fieldId]);
  
  if (isTransitioningMap) {
    return null;
  }

  return (
    <>
      {gateways.map(gateway => ( 
        <Gateway key={gateway.id} gateway={gateway} onIntersect={handleTransition} />
      ))}
    </>
  )
}

export default Gateways;