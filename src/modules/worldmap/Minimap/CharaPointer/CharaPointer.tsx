import { useEffect, useRef } from 'react'

import useGlobalStore from '../../../../store'
import { computeMapNormalisedPosition, psxAngleToCssDegrees } from '../minimapUtils'
import styles from './CharaPointer.module.css'

type CharaPointerProps = {
  isSolid?: boolean
}

const CharaPointer = ({ isSolid = false }: CharaPointerProps) => {
  const markerRef = useRef<HTMLDivElement>(null)
  const fillColor = isSolid ? '#ffae44' : '#ffffff'
  const strokeColor = isSolid ? '#3a1f00' : '#000000'

  useEffect(() => {
    const applyTransform = () => {
      const element = markerRef.current
      if (!element) {
        return
      }
      const { characterPosition, fieldDirection } = useGlobalStore.getState()
      element.style.setProperty('--rotation', `${psxAngleToCssDegrees(fieldDirection)}deg`)
      if (characterPosition) {
        const { u, v } = computeMapNormalisedPosition(characterPosition.x, characterPosition.z)
        element.style.left = `${u * 100}%`
        element.style.top = `${v * 100}%`
      }
    }
    applyTransform()
    return useGlobalStore.subscribe(applyTransform)
  }, [])

  return (
    <div className={`${styles.marker} ${isSolid ? styles.solid : styles.pulsing}`} ref={markerRef}>
      <svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <polygon fill={fillColor} points="6,0 11,11 6,8 1,11" stroke={strokeColor} strokeWidth="1" />
      </svg>
    </div>
  )
}

export default CharaPointer
