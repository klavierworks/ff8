import useDriving from './useDriving'
import useGardenLanding from './useGardenLanding'
import usePullAwayVibration from './usePullAwayVibration'
import useVehicleBoarding from './useVehicleBoarding'

const GroundVehicle = () => {
  useVehicleBoarding()
  useDriving()
  useGardenLanding()
  usePullAwayVibration()

  return null
}

export default GroundVehicle
