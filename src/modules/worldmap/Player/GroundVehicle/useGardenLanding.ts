import { GARDEN_LANDING_FRAMES } from '../../../../constants/worldmapVehicles'
import useGlobalStore from '../../../../store'
import { psxHeightToWorldY, worldYToPsxHeight } from '../../terrain'
import useScriptTick from '../../useScriptTick'
import useWorldmapStore, { WORLD_MAP_STATE_GARDEN_LANDING } from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import { convertFieldDirectionToHeading } from '../playerAngles'
import { readShipPose } from '../shipPose'
import { GardenLanding, getGroundVehicleState, setGroundVehicleState } from './groundVehicleState'
import { finishDisembark, getGroundVehicle, parkVehicle } from './groundVehicleUtils'

const finishGardenLanding = (landing: GardenLanding) => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  const vehicle = getGroundVehicle(useWorldmapStore.getState().vehicleId)
  if (vehicle && characterPosition) {
    parkVehicle(vehicle, readShipPose(characterPosition), convertFieldDirectionToHeading(fieldDirection))
  }
  finishDisembark(landing.spot)
}

const runLandingTick = (landing: GardenLanding) => {
  const position = useGlobalStore.getState().characterPosition
  if (!position) {
    return
  }
  position.y = psxHeightToWorldY(worldYToPsxHeight(position.y) + landing.altitudeStep)
  const elapsedTicks = landing.elapsedTicks + 1
  if (elapsedTicks > GARDEN_LANDING_FRAMES) {
    finishGardenLanding(landing)
    return
  }
  setGroundVehicleState({ ...getGroundVehicleState(), landing: { ...landing, elapsedTicks } })
}

const useGardenLanding = () => {
  useScriptTick(
    () => {
      const { landing } = getGroundVehicleState()
      if (!landing || useWorldmapStore.getState().worldMapState !== WORLD_MAP_STATE_GARDEN_LANDING) {
        return
      }
      runLandingTick(landing)
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useGardenLanding
