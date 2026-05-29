import { CSSProperties } from 'react'

import CharaPointer from '../CharaPointer/CharaPointer'
import {
  MINIMAP_LARGE_HEIGHT_PERCENT,
  MINIMAP_LARGE_LEFT_PERCENT,
  MINIMAP_LARGE_TOP_PERCENT,
  MINIMAP_LARGE_WIDTH_PERCENT,
  MINIMAP_SMALL_HEIGHT_PERCENT,
  MINIMAP_SMALL_LEFT_PERCENT,
  MINIMAP_SMALL_TOP_PERCENT,
  MINIMAP_SMALL_WIDTH_PERCENT,
} from '../minimapUtils'
import styles from './MapView.module.css'

type MapViewProps = {
  locationName?: string
  variant: 'large' | 'small'
}

const LAYOUTS = {
  large: {
    height: MINIMAP_LARGE_HEIGHT_PERCENT,
    left: MINIMAP_LARGE_LEFT_PERCENT,
    top: MINIMAP_LARGE_TOP_PERCENT,
    width: MINIMAP_LARGE_WIDTH_PERCENT,
  },
  small: {
    height: MINIMAP_SMALL_HEIGHT_PERCENT,
    left: MINIMAP_SMALL_LEFT_PERCENT,
    top: MINIMAP_SMALL_TOP_PERCENT,
    width: MINIMAP_SMALL_WIDTH_PERCENT,
  },
} as const

const MapView = ({ locationName, variant }: MapViewProps) => {
  const layout = LAYOUTS[variant]
  const style: CSSProperties = {
    height: `${layout.height}%`,
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: `${layout.width}%`,
  }

  return (
    <div className={`${styles.panel} ${variant === 'large' ? styles.large : styles.small}`} style={style}>
      <CharaPointer isSolid={variant === 'large'} />
      {variant === 'large' && locationName && <span className={styles.locationLabel}>{locationName}</span>}
    </div>
  )
}

export default MapView
