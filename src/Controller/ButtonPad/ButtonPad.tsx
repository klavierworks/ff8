import { PointerEvent, useRef, useState } from 'react'
import { Vector2 } from 'three'

import { pulseHaptics } from '../controllerUtils'
import ButtonGlyph from './ButtonGlyph/ButtonGlyph'
import styles from './ButtonPad.module.css'
import {
  createAllButtonBounds,
  findTouchedButton,
  getButtonKeys,
  getClientPoint,
  getPressedButtons,
  PointerButtons,
  PsxButton,
  removePointer,
  setPointerButton,
} from './buttonPadUtils'

type ButtonPadProps = {
  buttons: readonly PsxButton[]
  className: string
  onKeysChange: (keys: ReadonlySet<string>) => void
}

const getButtonClassName = (button: PsxButton, isPressed: boolean) =>
  [styles.button, styles[button], isPressed && styles.pressed].filter(Boolean).join(' ')

const ButtonPad = ({ buttons, className, onKeysChange }: ButtonPadProps) => {
  const elementsRef = useRef<(HTMLElement | null)[]>([])
  const pointersRef = useRef<PointerButtons>(new Map())
  const [pressedButtons, setPressedButtons] = useState<ReadonlySet<PsxButton>>(new Set())

  const updatePointers = (pointers: PointerButtons) => {
    pointersRef.current = pointers
    const nextPressedButtons = getPressedButtons(pointers)
    setPressedButtons(nextPressedButtons)
    onKeysChange(getButtonKeys(nextPressedButtons))
  }

  const trackPointer = (pointerId: number, point: Vector2) => {
    const button = findTouchedButton(point, createAllButtonBounds(buttons, elementsRef.current))
    if (pointersRef.current.get(pointerId) === button) {
      return
    }
    if (button) {
      pulseHaptics()
    }
    updatePointers(setPointerButton(pointersRef.current, pointerId, button))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    trackPointer(event.pointerId, getClientPoint(event))
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return
    }
    trackPointer(event.pointerId, getClientPoint(event))
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return
    }
    updatePointers(removePointer(pointersRef.current, event.pointerId))
  }

  return (
    <div
      className={`${styles.pad} ${className}`}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
    >
      {buttons.map((button, index) => (
        <span
          className={getButtonClassName(button, pressedButtons.has(button))}
          key={button}
          ref={(element) => {
            elementsRef.current[index] = element
          }}
        >
          <ButtonGlyph button={button} />
        </span>
      ))}
    </div>
  )
}

export default ButtonPad
