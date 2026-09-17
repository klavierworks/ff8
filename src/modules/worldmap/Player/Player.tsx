import { Suspense, useEffect } from 'react'

import { VEHICLE_IDS } from '../../../constants/vehicles'
import { getScriptFrame } from '../../field/scriptClock'
import { preloadCharaone } from '../charaoneAssets'
import { isRidingState } from '../Trains/trainRide'
import { isTrainClass } from '../vehicleClasses'
import useWorldmapStore from '../worldmapStore'
import { ON_FOOT_CHARAONE_SECTION } from './constants'
import FlyingRagnarok from './FlyingRagnarok/FlyingRagnarok'
import GroundVehicle from './GroundVehicle/GroundVehicle'
import { getGroundVehicle } from './GroundVehicle/groundVehicleUtils'
import { setWorldmapEntryTick } from './movementState'
import OnFootPlayer from './OnFootPlayer/OnFootPlayer'

const isOnFootVehicle = (vehicleId: number, worldMapState: number) =>
  vehicleId !== VEHICLE_IDS.RAGNAROK &&
  !isTrainClass(vehicleId) &&
  !isRidingState(worldMapState) &&
  getGroundVehicle(vehicleId) === undefined

const Player = () => {
  const isOnFoot = useWorldmapStore((state) => isOnFootVehicle(state.vehicleId, state.worldMapState))

  useEffect(() => {
    setWorldmapEntryTick(getScriptFrame())
    preloadCharaone(ON_FOOT_CHARAONE_SECTION)
  }, [])

  return (
    <>
      {isOnFoot && (
        <Suspense fallback={null}>
          <OnFootPlayer />
        </Suspense>
      )}
      <FlyingRagnarok />
      <GroundVehicle />
    </>
  )
}

export default Player
