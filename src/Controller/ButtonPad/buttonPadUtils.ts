import { Box2, Vector2 } from 'three'

import { PSX_CONTROLS_MAP, TOUCH_BUTTON_HIT_SLOP } from '../../constants/controls'

export type PointerButtons = ReadonlyMap<number, null | PsxButton>

export type PsxButton = keyof typeof PSX_CONTROLS_MAP

type ButtonBounds = {
  bounds: Box2
  button: PsxButton
}

type ButtonDistance = {
  button: PsxButton
  distance: number
}

export const getClientPoint = (event: { clientX: number; clientY: number }) => new Vector2(event.clientX, event.clientY)

const createButtonBounds = (button: PsxButton, element: HTMLElement): ButtonBounds => {
  const rect = element.getBoundingClientRect()
  const bounds = new Box2(new Vector2(rect.left, rect.top), new Vector2(rect.right, rect.bottom))
  return { bounds: bounds.expandByScalar(TOUCH_BUTTON_HIT_SLOP), button }
}

export const createAllButtonBounds = (buttons: readonly PsxButton[], elements: readonly (HTMLElement | null)[]) =>
  buttons.flatMap((button, index) => {
    const element = elements[index]
    return element ? [createButtonBounds(button, element)] : []
  })

const pickNearer = (nearest: ButtonDistance | null, candidate: ButtonDistance) =>
  !nearest || candidate.distance < nearest.distance ? candidate : nearest

export const findTouchedButton = (point: Vector2, buttonBounds: readonly ButtonBounds[]) =>
  buttonBounds
    .filter(({ bounds }) => bounds.containsPoint(point))
    .map(({ bounds, button }) => ({ button, distance: bounds.getCenter(new Vector2()).distanceTo(point) }))
    .reduce(pickNearer, null)?.button ?? null

export const setPointerButton = (
  pointers: PointerButtons,
  pointerId: number,
  button: null | PsxButton,
): PointerButtons => new Map(pointers).set(pointerId, button)

export const removePointer = (pointers: PointerButtons, pointerId: number): PointerButtons =>
  new Map([...pointers].filter(([id]) => id !== pointerId))

export const getPressedButtons = (pointers: PointerButtons): ReadonlySet<PsxButton> =>
  new Set([...pointers.values()].filter((button): button is PsxButton => button !== null))

export const getButtonKeys = (buttons: ReadonlySet<PsxButton>): ReadonlySet<string> =>
  new Set([...buttons].map((button) => PSX_CONTROLS_MAP[button]))
