import { CSSProperties } from 'react'

import CharaPointer from '../CharaPointer/CharaPointer'
import {
  MINIMAP_PLANET_CENTER_LEFT_PERCENT,
  MINIMAP_PLANET_CENTER_TOP_PERCENT,
  MINIMAP_PLANET_DIAMETER_PERCENT,
} from '../minimapUtils'
import styles from './PlanetView.module.css'

const PlanetView = () => {
  const planetStyle: CSSProperties = {
    height: `${MINIMAP_PLANET_DIAMETER_PERCENT}%`,
    left: `${MINIMAP_PLANET_CENTER_LEFT_PERCENT}%`,
    top: `${MINIMAP_PLANET_CENTER_TOP_PERCENT}%`,
    width: `${MINIMAP_PLANET_DIAMETER_PERCENT}%`,
  }

  return (
    <div className={styles.planet} style={planetStyle}>
      <CharaPointer />
    </div>
  )
}

export default PlanetView
