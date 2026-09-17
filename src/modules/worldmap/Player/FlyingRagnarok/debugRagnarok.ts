import { VEHICLE_IDS } from '../../../../constants/vehicles'
import { RAGNAROK_FOOTPRINT } from '../../../../constants/worldmapEntities'
import useGlobalStore from '../../../../store'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../worldmapStore'
import { calculateHeadingStep } from '../drivingUtils'
import { convertFieldDirectionToHeading } from '../playerAngles'
import { readShipPose, wrapMapX, wrapMapZ } from '../shipPose'
import { placeRagnarokEntity } from './ragnarokEntity'

export const placeDebugRagnarokBesidePlayer = () => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  const { vehicleId, worldMapState } = useWorldmapStore.getState()
  if (!characterPosition || vehicleId === VEHICLE_IDS.RAGNAROK || worldMapState !== WORLD_MAP_STATE_FREE_ROAM) {
    return
  }
  const shipYaw = convertFieldDirectionToHeading(fieldDirection)
  const player = readShipPose(characterPosition)
  const step = calculateHeadingStep(RAGNAROK_FOOTPRINT.width, shipYaw)
  placeRagnarokEntity(
    { altitude: player.altitude, x: wrapMapX(player.x + step.x), z: wrapMapZ(player.z + step.z) },
    shipYaw,
  )
}
