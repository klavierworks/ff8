import { Group, Object3D, Scene, Vector3 } from 'three'

import { PSX_CONTROLS_MAP } from '../../../../constants/controls'
import LerpValue from '../../../../LerpValue'
import useGlobalStore from '../../../../store'
import { BackgroundAnimation } from '../../backgroundAnimation'
import { checkForIntersectingMeshes } from '../../Gateways/gatewayUtils'
import {
  EMITTER_MODE_ENTITY_FLAG,
  EMITTER_MODE_OFF,
  EMITTER_MODE_PATH,
  EMITTER_SLOT_COUNT,
} from '../../Particles/particleSimulation'
import { getScriptFrame, nextScriptFrame } from '../../scriptClock'
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
  4: PSX_CONTROLS_MAP.l1,
  8: PSX_CONTROLS_MAP.r1,
  16: PSX_CONTROLS_MAP.circle,
  32: PSX_CONTROLS_MAP.triangle,
  64: PSX_CONTROLS_MAP.cross,
  128: PSX_CONTROLS_MAP.square,
  256: PSX_CONTROLS_MAP.select,
  2048: PSX_CONTROLS_MAP.start,
  4096: 'ArrowUp',
  8192: 'ArrowRight',
  16384: 'ArrowDown',
  32768: 'ArrowLeft',
} as const

const PRESS_EDGE_LIFETIME_FRAMES = 2

let heldKeys: string[] = []
const pressedAtFrame = new Map<string, number>()

const getKeysForMask = (mask: number) =>
  Object.entries(KEY_FLAGS)
    .filter(([bit]) => (mask & Number(bit)) !== 0)
    .map(([, key]) => key)

const consumePressEdge = (key: string) => {
  const pressedFrame = pressedAtFrame.get(key)
  if (pressedFrame === undefined || getScriptFrame() - pressedFrame >= PRESS_EDGE_LIFETIME_FRAMES) {
    return false
  }

  pressedAtFrame.delete(key)
  return true
}

export const isKeyDown = (mask: number) => getKeysForMask(mask).some((key) => heldKeys.includes(key))

export const wasKeyPressed = (mask: number) => getKeysForMask(mask).some(consumePressEdge)

const keydownListener = (event: KeyboardEvent) => {
  const { currentMessages, isCardGameActive } = useGlobalStore.getState()
  const hasBlockingMessage = currentMessages.some((message) => message.isCloseable)
  if (hasBlockingMessage || isCardGameActive || event.repeat) {
    return
  }

  if (!heldKeys.includes(event.code)) {
    heldKeys = [...heldKeys, event.code]
  }
  pressedAtFrame.set(event.code, getScriptFrame())
}

const keyupListener = (event: KeyboardEvent) => {
  heldKeys = heldKeys.filter((key) => key !== event.code)
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
  ease: ScrollEase,
) => {
  const transition: CameraScrollTransition = {
    duration,
    ease,
    endX: newX,
    endY: newY,
    isInProgress: true,
    positioning,
    startX: currentTransition?.endX ?? 0,
    startY: currentTransition?.endY ?? 0,
  }
  return transition
}

const CAMERA_SCROLL_SLOT = 0

export const setCameraScroll = (
  x: number,
  y: number,
  duration: number,
  positioning: ScrollPositionMode,
  ease: ScrollEase = 'linear',
) => {
  const currentTransition = useGlobalStore.getState().cameraScrollOffset
  const transition = constructScrollTransition(currentTransition, x, y, duration, positioning, ease)

  useGlobalStore.setState({ cameraScrollOffset: transition })
}

export const getScrollTransition = (layerIndex: number) => {
  const { cameraScrollOffset, layerScrollOffsets } = useGlobalStore.getState()

  if (layerIndex === CAMERA_SCROLL_SLOT) {
    return cameraScrollOffset
  }
  return layerScrollOffsets[layerIndex]
}

export const setLayerScroll = (
  layerIndex: number,
  x: number,
  y: number,
  duration: number,
  positioning: ScrollPositionMode,
  ease: ScrollEase = 'linear',
) => {
  // Slot 0 of the -2/-3 scroll opcodes is the camera pan, not a parallax layer, so
  // DSCROLL2(0, x, y) is the same request as DSCROLL(x, y) and moves the whole scene.
  if (layerIndex === CAMERA_SCROLL_SLOT) {
    setCameraScroll(x, y, duration, positioning, ease)
    return
  }

  const currentTransition = useGlobalStore.getState().layerScrollOffsets[layerIndex]
  const transition = constructScrollTransition(currentTransition, x, y, duration, positioning, ease)

  useGlobalStore.setState({
    layerScrollOffsets: {
      ...useGlobalStore.getState().layerScrollOffsets,
      [layerIndex]: transition,
    },
  })
}

export const showBackgroundAnimation = (parameter: number, animation: BackgroundAnimation) => {
  useGlobalStore.getState().backgroundAnimations[parameter]?.progress.stop()
  useGlobalStore.setState({
    backgroundAnimations: {
      ...useGlobalStore.getState().backgroundAnimations,
      [parameter]: animation,
    },
    backgroundLayerVisibility: {
      ...useGlobalStore.getState().backgroundLayerVisibility,
      [parameter]: true,
    },
  })
}

export const waitForBackgroundAnimation = async (parameter: number) => {
  while (useGlobalStore.getState().backgroundAnimations[parameter]?.progress.isAnimating) {
    await nextScriptFrame()
  }
}

export const setCameraAndLayerFocus = async (object: Object3D, duration: number) => {
  const { layerScrollOffsets } = useGlobalStore.getState()
  Object.keys(layerScrollOffsets).forEach((layerIndex) => {
    setLayerScroll(Number(layerIndex), 0, 0, duration, 'camera')
  })

  setCameraScroll(0, 0, duration, 'camera')

  const spring = new LerpValue(0)
  useGlobalStore.setState({
    cameraFocusObject: object,
    cameraFocusSpring: spring,
  })

  spring.start(1, duration)
  while (spring.isAnimating) {
    await nextScriptFrame()
  }
}

const EMITTER_SLOT_MASK = EMITTER_SLOT_COUNT - 1

const setParticleEmitter = (slot: number, mode: number) => {
  const target = slot & EMITTER_SLOT_MASK
  const particleEmitters = useGlobalStore
    .getState()
    .particleEmitters.map((current, index) => (index === target ? mode : current))

  useGlobalStore.setState({ particleEmitters })
}

export const enableParticleEmitter = (slot: number) => setParticleEmitter(slot, EMITTER_MODE_PATH)

export const disableParticleEmitter = (slot: number) => setParticleEmitter(slot, EMITTER_MODE_OFF)

export const bindParticleEmitterToEntity = (slot: number, entityId: number) =>
  setParticleEmitter(slot, EMITTER_MODE_ENTITY_FLAG | entityId)

export const triggerFadeout = () => {
  const { fadeSpring } = useGlobalStore.getState()
  useGlobalStore.setState({ isFieldDrawSuppressed: false })
  fadeSpring.start(0, 500)
}

export const awaitFadesync = async () => {
  const { fadeSpring } = useGlobalStore.getState()
  while (fadeSpring.isAnimating) {
    await nextScriptFrame()
  }
}
