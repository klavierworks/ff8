import { useEffect } from 'react'

import { VEHICLE_IDS } from '../../../constants/vehicles'
import { getScriptFrame } from '../../field/scriptClock'
import { FieldLandingPosition } from '../useSections'
import useWorldmapStore from '../worldmapStore'
import FlyingRagnarok from './FlyingRagnarok/FlyingRagnarok'
import { setWorldmapEntryTick } from './movementState'
import OnFootPlayer from './OnFootPlayer/OnFootPlayer'

type PlayerProps = {
  landings: readonly FieldLandingPosition[]
}

const Player = ({ landings }: PlayerProps) => {
  const isAboardRagnarok = useWorldmapStore((state) => state.vehicleId === VEHICLE_IDS.RAGNAROK)

  useEffect(() => {
    setWorldmapEntryTick(getScriptFrame())
  }, [])

  return (
    <>
      {!isAboardRagnarok && <OnFootPlayer landings={landings} />}
      <FlyingRagnarok />
    </>
  )
}

export default Player
