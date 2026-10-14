import { CSSProperties, PointerEvent, useRef, useState } from 'react'

import { TOUCH_STICK_RADIUS } from '../../constants/controls'
import styles from './Joystick.module.css'
import {
  ActiveStick,
  calculateNextStick,
  createActiveStick,
  getBaseStyle,
  getKnobStyle,
  getLocalPoint,
  getStickKeys,
} from './joystickUtils'

type JoystickProps = {
  className: string
  onKeysChange: (keys: ReadonlySet<string>) => void
}

const ZONE_STYLE = { '--stick-radius': `${TOUCH_STICK_RADIUS}px` } as CSSProperties

const getBaseClassName = (isActive: boolean) => (isActive ? `${styles.base} ${styles.active}` : styles.base)

const Joystick = ({ className, onKeysChange }: JoystickProps) => {
  const stickRef = useRef<ActiveStick | null>(null)
  const [stick, setStick] = useState<ActiveStick | null>(null)

  const updateStick = (nextStick: ActiveStick | null) => {
    stickRef.current = nextStick
    setStick(nextStick)
    onKeysChange(getStickKeys(nextStick))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (stickRef.current) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    updateStick(createActiveStick(event.pointerId, getLocalPoint(event)))
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const currentStick = stickRef.current
    if (!currentStick || currentStick.pointerId !== event.pointerId) {
      return
    }
    updateStick(calculateNextStick(currentStick, getLocalPoint(event)))
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (stickRef.current?.pointerId !== event.pointerId) {
      return
    }
    updateStick(null)
  }

  return (
    <div
      className={`${styles.zone} ${className}`}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      style={ZONE_STYLE}
    >
      <div className={getBaseClassName(stick !== null)} style={getBaseStyle(stick)}>
        <div className={styles.knob} style={getKnobStyle(stick)} />
      </div>
    </div>
  )
}

export default Joystick
