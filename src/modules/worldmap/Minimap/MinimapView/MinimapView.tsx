import { MINIMAP_MODE_LARGE, MINIMAP_MODE_PLANET, MINIMAP_MODE_SMALL } from '../constants'
import FullMap from './FullMap/FullMap'
import PlanetView from './PlanetView/PlanetView'
import SmallMap from './SmallMap/SmallMap'
import useMinimapTextures from './useMinimapTextures'

type MinimapViewProps = {
  mode: number
}

const MinimapView = ({ mode }: MinimapViewProps) => {
  const textures = useMinimapTextures()

  if (mode === MINIMAP_MODE_PLANET) {
    return <PlanetView textures={textures} />
  }
  if (mode === MINIMAP_MODE_SMALL) {
    return <SmallMap textures={textures} />
  }
  if (mode === MINIMAP_MODE_LARGE) {
    return <FullMap textures={textures} />
  }
  return null
}

export default MinimapView
