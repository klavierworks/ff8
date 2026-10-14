import { MouseEvent } from 'react'

import { TOUCH_FACE_BUTTONS, TOUCH_SHOULDER_BUTTONS, TOUCH_SYSTEM_BUTTONS } from '../constants/controls'
import ButtonPad from './ButtonPad/ButtonPad'
import styles from './Controller.module.css'
import Joystick from './Joystick/Joystick'
import useRevealOpacity from './useRevealOpacity'
import useVirtualKeyboard from './useVirtualKeyboard'

type ControllerProps = {
  hasIntroTransition: boolean
}

const handleContextMenu = (event: MouseEvent) => event.preventDefault()

const Controller = ({ hasIntroTransition }: ControllerProps) => {
  const setSourceKeys = useVirtualKeyboard()
  const controlsRef = useRevealOpacity<HTMLElement>(hasIntroTransition)

  return (
    <nav className={styles.controls} onContextMenu={handleContextMenu} ref={controlsRef}>
      <ButtonPad
        buttons={TOUCH_SHOULDER_BUTTONS}
        className={styles.shoulders}
        onKeysChange={(keys) => setSourceKeys('shoulders', keys)}
      />
      <Joystick className={styles.stick} onKeysChange={(keys) => setSourceKeys('stick', keys)} />
      <ButtonPad
        buttons={TOUCH_SYSTEM_BUTTONS}
        className={styles.system}
        onKeysChange={(keys) => setSourceKeys('system', keys)}
      />
      <ButtonPad
        buttons={TOUCH_FACE_BUTTONS}
        className={styles.face}
        onKeysChange={(keys) => setSourceKeys('face', keys)}
      />
    </nav>
  )
}

export default Controller
