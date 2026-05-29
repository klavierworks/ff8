import useGlobalStore from '../../../store'
import useWorldmapStore from '../worldmapStore'
import MapView from './MapView/MapView'
import { MINIMAP_MODE_HIDDEN, MINIMAP_MODE_LARGE, MINIMAP_MODE_PLANET, MINIMAP_MODE_SMALL } from './minimapUtils'
import PlanetView from './PlanetView/PlanetView'
import useCurrentLocationName from './useCurrentLocationName'

const Minimap = () => {
  const minimapMode = useWorldmapStore((state) => state.minimapMode)
  const characterPosition = useGlobalStore((state) => state.characterPosition)

  const locationName = useCurrentLocationName(characterPosition?.x ?? 0, characterPosition?.z ?? 0)

  if (minimapMode === MINIMAP_MODE_HIDDEN || !characterPosition) {
    return null
  }

  if (minimapMode === MINIMAP_MODE_PLANET) {
    return <PlanetView />
  }
  if (minimapMode === MINIMAP_MODE_SMALL) {
    return <MapView variant="small" />
  }
  if (minimapMode === MINIMAP_MODE_LARGE) {
    return <MapView locationName={locationName} variant="large" />
  }
  return null
}

export default Minimap
