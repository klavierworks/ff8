import { Group, Object3D, Scene, Vector3 } from 'three'

import { PSX_CONTROLS_MAP } from '../../../../constants/controls'
import LerpValue from '../../../../LerpValue'
import useGlobalStore from '../../../../store'
import { checkForIntersectingMeshes } from '../../Gateways/gatewayUtils'
import { getScriptEntity } from './Model/modelUtils'
import { openMessage } from './utils'

export const displayMessage = async (
  id: number,
  x: number,
  y: number,
  channel: number,
  width?: number,
  height?: number,
  isCloseable = true,
) => {
  const { availableMessages } = useGlobalStore.getState()

  const uniqueId = `${id}--${Date.now()}`
  await openMessage(
    uniqueId,
    availableMessages[id],
    {
      channel,
      height,
      width,
      x,
      y,
    },
    isCloseable,
    undefined,
  )
}

export const isTouching = (thisId: number, target: Object3D | string, scene: Scene) => {
  const thisMesh = getScriptEntity(scene, thisId) as Group
  const targetMesh = target instanceof Object3D ? target : (scene.getObjectByName(target) as Group)

  if (!thisMesh || !targetMesh) {
    return false
  }

  const isIntersecting = checkForIntersectingMeshes(thisMesh, targetMesh)

  const thisPosition = thisMesh.getWorldPosition(new Vector3())
  const targetPosition = targetMesh.getWorldPosition(new Vector3())

  return thisPosition.distanceTo(targetPosition) < 0.04 || isIntersecting
}

export const KEY_FLAGS = {
  16: PSX_CONTROLS_MAP.circle, // 'Cancel'
  32: PSX_CONTROLS_MAP.triangle, // 'Menu'
  64: PSX_CONTROLS_MAP.cross, // 'OK/Accept'
  128: PSX_CONTROLS_MAP.square, //'Card game button'

  192: PSX_CONTROLS_MAP.cross, // 'OK/Accept',

  4096: 'ArrowUp',
  8192: 'ArrowRight',
  16384: 'ArrowDown',
  32768: 'ArrowLeft',
} as const

let DOWN: string[] = []
let KEYS_PRESSED: string[] = []
export const isKeyDown = (keyFlag: keyof typeof KEY_FLAGS) => {
  return DOWN.includes(KEY_FLAGS[keyFlag])
}

export const wasKeyPressed = (keyFlag: keyof typeof KEY_FLAGS) => {
  const key = KEY_FLAGS[keyFlag]
  if (!key) {
    return false
  }
  const wasPressed = KEYS_PRESSED.includes(key)
  if (wasPressed) {
    KEYS_PRESSED = KEYS_PRESSED.filter((k) => k !== key)
  }
  return wasPressed
}
const keydownListener = (event: KeyboardEvent) => {
  const { currentMessages } = useGlobalStore.getState()
  if (currentMessages.length > 0) {
    return
  }
  DOWN.push(event.code)
  if (KEYS_PRESSED.includes(event.code)) {
    return
  }
  KEYS_PRESSED.push(event.code)
}

const keyupListener = (event: KeyboardEvent) => {
  DOWN = DOWN.filter((key) => key !== event.code)
}

export const attachKeyDownListeners = () => {
  window.addEventListener('keydown', keydownListener)
  window.addEventListener('keyup', keyupListener)
}

const constructScrollTransition = (
  currentTransition: CameraScrollTransition,
  newX: number,
  newY: number,
  duration: number,
  positioning: ScrollPositionMode,
) => {
  const transition: CameraScrollTransition = {
    duration,
    endX: newX,
    endY: newY,
    isInProgress: true,
    positioning,
    startX: currentTransition?.endX ?? 0,
    startY: currentTransition?.endY ?? 0,
  }
  console.log(
    'Constructed scroll transition:',
    'from',
    transition.startX,
    transition.startY,
    ' to ',
    transition.endX,
    transition.endY,
    ' over ',
    duration,
    'ms, positioning:',
    positioning,
  )
  return transition
}

export const setCameraScroll = (x: number, y: number, duration: number, positioning: ScrollPositionMode) => {
  const currentTransition = useGlobalStore.getState().cameraScrollOffset
  const transition = constructScrollTransition(currentTransition, x, y, duration, positioning)

  useGlobalStore.setState({ cameraScrollOffset: transition })
}

export const setLayerScroll = (
  layerIndex: number,
  x: number,
  y: number,
  duration: number,
  positioning: ScrollPositionMode,
  shouldCameraRemainFocusedOnLayer = false,
) => {
  if (shouldCameraRemainFocusedOnLayer) {
    setCameraScroll(-x / 2, y / 2, duration, 'camera')
  }

  const currentTransition = useGlobalStore.getState().layerScrollOffsets[layerIndex!]
  const transition = constructScrollTransition(currentTransition, x / 2, y / 2, duration, positioning)

  useGlobalStore.setState({
    layerScrollOffsets: {
      ...useGlobalStore.getState().layerScrollOffsets,
      [layerIndex!]: transition,
    },
  })
}

export const setCameraAndLayerFocus = async (object: Object3D, duration: number) => {
  const { layerScrollOffsets } = useGlobalStore.getState()
  Object.keys(layerScrollOffsets).forEach((layerIndex) => {
    setLayerScroll(Number(layerIndex), 0, 0, duration, 'camera', false)
  })

  setCameraScroll(0, 0, duration, 'camera')

  const spring = new LerpValue(0)
  useGlobalStore.setState({
    cameraFocusObject: object,
    cameraFocusSpring: spring,
  })

  spring.start(1, duration)
  while (spring.isAnimating) {
    await new Promise(requestAnimationFrame)
  }
}

export const triggerFadeout = () => {
  const { fadeSpring } = useGlobalStore.getState()
  fadeSpring.start(0, 500)
}

export const awaitFadesync = async () => {
  const { fadeSpring } = useGlobalStore.getState()
  while (fadeSpring.isAnimating) {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}
