import { Scene, Vector3 } from 'three'

import { MUSIC_IDS } from '../../../constants/audio'
import { DRAW_POINTS } from '../../../constants/drawPoints'
import MAP_NAMES from '../../../constants/maps'
import { SPEEDS } from '../../../constants/speeds'
import LerpValue from '../../../LerpValue'
import useGlobalStore from '../../../store'
import { floatingPointToNumber, numberToFloatingPoint, vectorToFloatingPoint } from '../../../utils'
import { Opcode, OpcodeObj, Script } from '../types'
import { createAnimationController } from './AnimationController/AnimationController'
import {
  displayMessage,
  isKeyDown,
  isTouching,
  KEY_FLAGS,
  setCameraAndLayerFocus,
  setCameraScroll,
  setLayerScroll,
  wasKeyPressed,
} from './common'
import { getPartyMemberModelComponent, getScriptEntity } from './Model/modelUtils'
import createMovementController from './MovementController/MovementController'
import { handleLadder } from './MovementController/utils'
import MusicController from './MusicController'
import createRotationController from './RotationController/RotationController'
import createSFXController from './SFXController/SFXController'
import { preloadSound } from './SFXController/webAudio'
import createScriptState, { ScriptState } from './state'
import {
  closeMessage,
  enableMessageToClose,
  openMessage,
  remoteExecute,
  remoteExecutePartyMember,
  unusedCommand,
  wait,
} from './utils'

const dummiedCommand = () => {}
const unusedCommand = () => {}

export const musicController = MusicController()

type HandlerArgs = {
  animationController: ReturnType<typeof createAnimationController>
  currentOpcode: OpcodeObj
  currentOpcodeIndex: number
  currentState: Readonly<ScriptState>
  headController: ReturnType<typeof createRotationController>
  movementController: ReturnType<typeof createMovementController>
  opcodes: OpcodeObj[]
  rotationController: ReturnType<typeof createRotationController>
  scene: Scene
  script: Script
  setState: ReturnType<typeof createScriptState>['setState']
  sfxController: ReturnType<typeof createSFXController>
  STACK: number[]
  TEMP_STACK: Record<number, number>
}

type HandlerFuncWithPromise = (args: HandlerArgs) => (number | void) | Promise<number | void>

export let MEMORY: Record<number, number> = {
  72: 9999, // gil
  84: 201, // last area visited
  256: 0, // progress
  491: 0, // touk
  528: 0, // subprogress
  534: 1, // ?

  641: 96,

  720: 0, // squall model
  721: 0, // zell model

  722: 0, // selphie model
  723: 0, // quistis model
  1024: 0,
  1025: 0,
}

export const restoreMemory = (savedMemory: typeof MEMORY) => {
  MEMORY = {
    ...savedMemory,
  }
}

export const MESSAGE_VARS: Record<number, string> = {}

export const OPCODE_HANDLERS: Record<Opcode, HandlerFuncWithPromise> = {
  AASK: async ({ STACK, TEMP_STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const cancelOpt = STACK.pop() as number
    const defaultOpt = STACK.pop() as number
    const last = STACK.pop() as number
    const first = STACK.pop() as number

    const id = STACK.pop() as number
    const channel = STACK.pop() as number

    const { availableMessages } = useGlobalStore.getState()

    const uniqueId = `${id}--${Date.now()}`

    const result = await openMessage(
      uniqueId,
      availableMessages[id],
      { channel, height: undefined, width: undefined, x, y },
      true,
      {
        blocked: undefined,
        cancel: cancelOpt,
        default: defaultOpt,
        first,
        last,
      },
    )
    TEMP_STACK[0] = result
  },
  ACTORMODE: ({ setState, STACK }) => {
    const mode = STACK.pop() as number
    setState({
      actorMode: mode,
    })
  },
  ADDGIL: ({ STACK }) => {
    const gil = STACK.pop() as number
    MEMORY[72] += gil
  },
  ADDITEM: ({ STACK }) => {
    STACK.splice(-2)
  },
  ADDMAGIC: ({ STACK }) => {
    STACK.splice(-3)
  },
  ADDMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number
    useGlobalStore.setState({
      availableCharacters: [...useGlobalStore.getState().availableCharacters, characterID],
    })
  },
  ADDPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number
    useGlobalStore.setState((state) => ({
      ...state,
      party: [...state.party, characterID],
    }))
  },
  ADDPASTGIL: ({ STACK }) => {
    STACK.pop() as number
  },
  ADDSEEDLEVEL: ({ STACK }) => {
    STACK.pop() as number
  },
  ALLSEPOS: ({ STACK }) => {
    STACK.splice(-1)
  },
  ALLSEPOSTRANS: ({ STACK }) => {
    STACK.splice(-3)
  },
  ALLSEVOL: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number

    sfxController.setVolume(undefined, volume)
  },
  ALLSEVOLTRANS: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number
    const duration = STACK.pop() as number

    sfxController.setVolume(undefined, volume, duration)
  },
  AMES: ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number
    const id = STACK.pop() as number
    const channel = STACK.pop() as number

    displayMessage(id, x, y, channel, undefined, undefined, false)
  },
  AMESW: async ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number
    const id = STACK.pop() as number
    const channel = STACK.pop() as number

    await displayMessage(id, x, y, channel)
  },
  ANGELODISABLE: ({ STACK }) => {
    STACK.pop() as number
  },
  ANIME: async ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param

    await animationController.playAnimation(animationId)
  },
  ANIMEKEEP: async ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param

    await animationController.playAnimation(animationId, {
      shouldHoldLastFrame: true,
    })
  },
  ANIMESPEED: ({ animationController, STACK }) => {
    animationController.setAnimationSpeed(STACK.pop() as number)
  },
  ANIMESTOP: ({ animationController }) => {
    animationController.pauseAnimation(true)
  },
  ANIMESYNC: async ({ animationController }) => {
    while (!animationController.getIsSafeToMoveOn()) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  ASK: (args) => {
    const { STACK } = args
    STACK.push(5)
    STACK.push(5)

    OPCODE_HANDLERS?.AASK?.(args)
  },
  AXIS: ({ STACK }) => {
    STACK.splice(-2)
  },
  AXISSYNC: unusedCommand,
  BASEANIME: ({ animationController, currentOpcode, STACK }) => {
    const standAnimationId = currentOpcode.param
    const runAnimationId = STACK.pop() as number
    const walkAnimationId = STACK.pop() as number

    animationController.setIdleAnimations(standAnimationId, runAnimationId, walkAnimationId)
  },
  BATTLE: async ({ STACK }) => {
    STACK.splice(-2)
  },
  BATTLECUT: dummiedCommand,
  BATTLEMODE: ({ STACK }) => {
    STACK.pop() as number
  },
  BATTLEOFF: dummiedCommand,
  BATTLEON: dummiedCommand,
  BATTLERESULT: dummiedCommand,
  BGANIME: async ({ script, STACK }) => {
    const end = STACK.pop() as number
    const start = STACK.pop() as number

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId]
    const lerpValue = new LerpValue(start, SPEEDS.BG)
    const duration = lerpValue.calculateDuration(speed)
    lerpValue.start(end, duration, 0)

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue,
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true,
      },
    })
    while (useGlobalStore.getState().backgroundAnimations[script.backgroundParamId]?.isAnimating) {
      if (!useGlobalStore.getState().backgroundAnimations[script.backgroundParamId]) {
        return
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  BGANIMEFLAG: unusedCommand,
  BGANIMESPEED: ({ script, STACK }) => {
    const speed = STACK.pop() as number
    useGlobalStore.setState({
      backgroundLayerSpeeds: {
        ...useGlobalStore.getState().backgroundLayerSpeeds,
        [script.backgroundParamId]: speed,
      },
    })
  },
  BGANIMESYNC: async ({ script }) => {
    while (useGlobalStore.getState().backgroundAnimations[script.backgroundParamId].isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  BGCLEAR: ({ STACK }) => {
    const unknown = STACK.pop() as number

    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [unknown + 1]: false,
      },
    })
  },
  BGDRAW: ({ script, STACK }) => {
    const frame = STACK.pop() as number

    const lerpValue = new LerpValue(frame, SPEEDS.BG)

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue,
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true,
      },
    })
  },
  BGOFF: ({ script }) => {
    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: false,
      },
    })
  },
  BGSHADE: ({ script, STACK }) => {
    const endBlue = STACK.pop() as number
    const endGreen = STACK.pop() as number
    const endRed = STACK.pop() as number
    const startBlue = STACK.pop() as number
    const startGreen = STACK.pop() as number
    const startRed = STACK.pop() as number
    const duration = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      layerTints: {
        ...state.layerTints,
        [script.backgroundParamId]: {
          durationIn: duration,
          durationOut: 0,
          endBlue,
          endGreen,
          endRed,
          holdIn: 0,
          holdOut: 0,
          isLooping: false,
          startBlue,
          startGreen,
          startRed,
        },
      },
    }))
  },
  BGSHADEOFF: dummiedCommand,
  BGSHADESTOP: () => {},
  BLINKEYES: unusedCommand,
  BROKEN: ({ STACK }) => {
    STACK.splice(-8)
  },
  CAL: ({ currentOpcode, STACK }) => {
    const value2 = STACK.pop() as number
    const value1 = STACK.pop() as number
    if (currentOpcode.param === 0) {
      STACK.push(value1 + value2)
    } else if (currentOpcode.param === 1) {
      STACK.push(value1 - value2)
    } else if (currentOpcode.param === 2) {
      STACK.push(value1 * value2)
    } else if (currentOpcode.param === 3) {
      STACK.push(value1 / value2)
    } else if (currentOpcode.param === 4) {
      STACK.push(value1 % value2)
    } else if (currentOpcode.param === 5) {
      if (value1 !== undefined) {
        STACK.push(value1)
      }
      STACK.push(-value2)
    } else if (currentOpcode.param === 6) {
      STACK.push(value1 === value2 ? 1 : 0)
    } else if (currentOpcode.param === 7) {
      STACK.push(value1 > value2 ? 1 : 0)
    } else if (currentOpcode.param === 8) {
      STACK.push(value1 >= value2 ? 1 : 0)
    } else if (currentOpcode.param === 9) {
      STACK.push(value1 < value2 ? 1 : 0)
    } else if (currentOpcode.param === 10) {
      STACK.push(value1 <= value2 ? 1 : 0)
    } else if (currentOpcode.param === 11) {
      STACK.push(value1 !== value2 ? 1 : 0)
    } else if (currentOpcode.param === 12) {
      STACK.push(value1 & value2)
    } else if (currentOpcode.param === 13) {
      STACK.push(value1 | value2)
    } else if (currentOpcode.param === 14) {
      STACK.push(value1 ^ value2)
    } else {
      console.warn(`CAL with param ${currentOpcode.param} not implemented.`)
    }
  },
  CANIME: async ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const firstFrame = STACK.pop() as number
    const lastFrame = STACK.pop() as number

    await animationController.playAnimation(animationId, {
      endFrame: lastFrame,
      startFrame: firstFrame,
    })
  },
  CANIMEKEEP: async ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const firstFrame = STACK.pop() as number
    const lastFrame = STACK.pop() as number

    await animationController.playAnimation(animationId, {
      endFrame: lastFrame,
      shouldHoldLastFrame: true,
      startFrame: firstFrame,
    })
  },
  CARDGAME: ({ STACK }) => {
    STACK.splice(-7)
  },
  CHANGEPARTY: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  CHOICEMUSIC: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  CLEAR: () => {
    MEMORY = {}
  },
  CLOSEEYES: dummiedCommand,
  CMOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const lastThree = STACK.splice(-3)
    const target = new Vector3(...(lastThree.map(numberToFloatingPoint) as [number, number, number]))

    await movementController.moveToPoint(target, {
      distanceToStopAnimationFromTarget,
      isAnimationEnabled: false,
      isFacingTarget: false,
    })
  },
  COFFSET: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    movementController.moveToOffset(x, y, z, duration)
  },
  COFFSETS: async ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const endZ = STACK.pop() as number
    const endY = STACK.pop() as number
    const endX = STACK.pop() as number
    const startZ = STACK.pop() as number
    const startY = STACK.pop() as number
    const startX = STACK.pop() as number
    await movementController.moveToOffset(startX, startY, startZ, 0)
    movementController.moveToOffset(endX, endY, endZ, duration)
  },
  COLSYNC: async () => {
    while (useGlobalStore.getState().isTransitioningColorOverlay) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  COPYINFO: ({ STACK }) => {
    STACK.pop() as number
  },
  CROSSMUSIC: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  CSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    setCameraScroll(x, y, duration, 'camera')
  },
  CSCROLL2: ({ STACK }) => {
    const duration = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const layerID = STACK.pop() as number

    setLayerScroll(layerID, x, y, duration, 'camera', true)
  },

  CSCROLL3: async ({ STACK }) => {
    const duration = STACK.pop() as number
    const endY = STACK.pop() as number
    const endX = STACK.pop() as number
    const startY = STACK.pop() as number
    const startX = STACK.pop() as number

    const layerID = STACK.pop() as number

    setLayerScroll(layerID, startX, startY, 0, 'camera')
    setLayerScroll(layerID, endX, endY, duration, 'camera')
  },

  CSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number
    const actorCode = STACK.pop() as number

    const mesh = getScriptEntity(scene, actorCode)
    setCameraAndLayerFocus(mesh, duration)
  },
  CSCROLLA2: ({ scene, STACK }) => {
    const duration = STACK.pop() as number
    const actorCode = STACK.pop() as number
    const layerID = STACK.pop() as number

    if (layerID !== 0) {
      console.warn('CSCROLLA2: Layer ID is not 0', layerID)
    }

    const mesh = getScriptEntity(scene, actorCode)
    setCameraAndLayerFocus(mesh, duration)
  },
  CSCROLLP: ({ scene, STACK }) => {
    const duration = STACK.pop() as number
    const partyMemberId = STACK.pop() as number

    const mesh = getPartyMemberModelComponent(scene, partyMemberId)
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' CSCROLLP')
      return
    }
    setCameraAndLayerFocus(mesh, duration)
  },
  CSCROLLP2: unusedCommand,
  CTURN: ({ rotationController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const targetId = STACK.pop() as number

    rotationController.turnToFaceEntity(`entity--${targetId}`, scene, duration)
  },
  CTURNL: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    await rotationController.turnToFaceAngle(angle, duration, 'left')
  },
  CTURNR: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    await rotationController.turnToFaceAngle(angle, duration, 'right')
  },
  DCOLADD: ({ STACK }) => {
    const red = STACK.pop() as number
    const green = STACK.pop() as number
    const blue = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      colorOverlay: {
        ...state.colorOverlay,
        duration: 0,
        endBlue: blue,
        endGreen: green,
        endRed: red,
        type: 'additive',
      },
      isTransitioningColorOverlay: true,
    }))
  },
  DCOLSUB: ({ STACK }) => {
    const red = STACK.pop() as number
    const green = STACK.pop() as number
    const blue = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      colorOverlay: {
        ...state.colorOverlay,
        duration: 0,
        endBlue: blue,
        endGreen: green,
        endRed: red,
        type: 'subtractive',
      },
      isTransitioningColorOverlay: true,
    }))
  },
  DEBUG: unusedCommand,
  DIR: ({ rotationController, STACK }) => {
    const angle = STACK.pop() as number
    rotationController.turnToFaceAngle(angle, 0)
  },
  DIRA: ({ rotationController, scene, STACK }) => {
    const targetActorId = STACK.pop() as number
    rotationController.turnToFaceEntity(`entity--${targetActorId}`, scene, 0)
  },
  DIRP: ({ rotationController, STACK }) => {
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const directionVector = vectorToFloatingPoint({ x, y, z })
    rotationController.turnToFaceDirection(directionVector, 0)
  },
  DISC: ({ STACK }) => {
    STACK.pop() as number
  },
  DISCJUMP: (args) => {
    OPCODE_HANDLERS?.['MAPJUMP3']?.(args)
  },
  DISPBAR: ({ STACK }) => {
    STACK.splice(-7)
  },
  DISPTIMER: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  DOFFSET: async ({ movementController, STACK }) => {
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    await movementController.setOffset(x, y, z)
  },
  DOORLINEOFF: ({ setState }) => {
    setState({ isDoorOn: false })
  },
  DOORLINEON: ({ setState }) => {
    setState({ isDoorOn: true })
  },
  DRAWPOINT: async ({ sfxController, STACK }) => {
    const drawPointId = STACK.pop() as number
    await sfxController.play(66, 0, 127, 128)
    preloadSound(67)
    await openMessage(
      'drawpoint',
      [`Found a draw point!\n${DRAW_POINTS[drawPointId]} found.`],
      {
        channel: 0,
        height: 40,
        width: 150,
        x: 110,
        y: 90,
      },
      true,
    )
    sfxController.play(67, 0, 127, 128)
  },
  DSCROLL: ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    setCameraScroll(x, y, 0, 'camera')
  },
  DSCROLL2: async ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const layerID = STACK.pop() as number

    setLayerScroll(layerID, x, y, 0, 'camera')
  },
  DSCROLL3: unusedCommand,
  DSCROLLA: async ({ scene, STACK }) => {
    const actorCode = STACK.pop() as number

    const mesh = getScriptEntity(scene, actorCode)
    setCameraAndLayerFocus(mesh, 0)
  },
  DSCROLLA2: ({ scene, STACK }) => {
    const actorCode = STACK.pop() as number
    const layerID = STACK.pop() as number

    if (layerID !== 0) {
      console.warn('DSCROLLA2: Layer ID is not 0', layerID)
    }

    const mesh = getScriptEntity(scene, actorCode)
    setCameraAndLayerFocus(mesh, 0)
  },
  DSCROLLP: async ({ scene, STACK }) => {
    const partyMemberId = STACK.pop() as number

    const mesh = getPartyMemberModelComponent(scene, partyMemberId)
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' DSCROLLP')
      return
    }
    setCameraAndLayerFocus(mesh, 0)
  },
  DSCROLLP2: unusedCommand,
  DUALMUSIC: ({ STACK }) => {
    const volume = STACK.pop() as number
    musicController.dualMusic(volume)
  },
  DYING: dummiedCommand, // resurrects dead members to 1hp
  EFFECTLOAD: ({ STACK }) => {
    const soundBankId = STACK.pop() as number
    console.log('EFFECTLOAD', soundBankId)
  },
  EFFECTPLAY: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number
    const pan = STACK.pop() as number
    const channel = STACK.pop() as number
    const sfxId = STACK.pop() as number
    sfxController.play(sfxId, channel, volume, pan)
  },
  EFFECTPLAY2: ({ currentOpcode, sfxController, STACK }) => {
    const channel = STACK.pop() as number
    const volume = STACK.pop() as number
    const pan = STACK.pop() as number
    const sfxId = currentOpcode.param
    sfxController.playFieldSound(sfxId, channel, volume, pan)
  },
  ENDING: unusedCommand,
  FACEDIR: ({ headController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const directionVector = vectorToFloatingPoint({ x, y, z })
    headController.turnToFaceDirection(directionVector, duration)
  },
  FACEDIRA: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const targetActorId = STACK.pop() as number
    headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration)
  },
  FACEDIRI: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number
    const y = STACK.pop() as number
    const z = STACK.pop() as number
    const x = STACK.pop() as number
    console.log(x, y, z, duration)
    const directionVector = vectorToFloatingPoint({ x, y, z })
    await headController.turnToFaceDirection(directionVector, duration)
  },
  FACEDIRINIT: ({ setState }) => {
    setState({
      isHeadTrackingPlayer: true,
    })
  },
  FACEDIRLIMIT: ({ STACK }) => {
    STACK.splice(-3)
  },
  FACEDIROFF: ({ headController, STACK }) => {
    const duration = STACK.pop() as number
    headController.turnToFaceAngle(0, duration)
  },
  FACEDIRP: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const partyMemberId = STACK.pop() as number
    headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration)
  },
  FACEDIRSYNC: async ({ headController }) => {
    while (headController.getState().angle.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  FADEBLACK: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(0)
  },
  FADEIN: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(1, 250)
  },
  FADENONE: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(1)
  },
  FADEOUT: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(0, 500)
  },
  FADESYNC: async () => {
    const { fadeSpring } = useGlobalStore.getState()
    while (fadeSpring.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  FCOLADD: ({ STACK }) => {
    const duration = STACK.pop() as number
    const endBlue = STACK.pop() as number
    const endGreen = STACK.pop() as number
    const endRed = STACK.pop() as number
    const startBlue = STACK.pop() as number
    const startGreen = STACK.pop() as number
    const startRed = STACK.pop() as number

    useGlobalStore.setState({
      colorOverlay: {
        duration,
        endBlue,
        endGreen,
        endRed,
        startBlue,
        startGreen,
        startRed,
        type: 'additive',
      },
      isTransitioningColorOverlay: true,
    })
  },
  FCOLSUB: ({ STACK }) => {
    const duration = STACK.pop() as number
    const endBlue = STACK.pop() as number
    const endGreen = STACK.pop() as number
    const endRed = STACK.pop() as number
    const startBlue = STACK.pop() as number
    const startGreen = STACK.pop() as number
    const startRed = STACK.pop() as number

    useGlobalStore.setState({
      colorOverlay: {
        duration,
        endBlue,
        endGreen,
        endRed,
        startBlue,
        startGreen,
        startRed,
        type: 'subtractive',
      },
      isTransitioningColorOverlay: true,
    })
  },
  FMOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const lastThree = STACK.splice(-3)
    const target = new Vector3(...(lastThree.map(numberToFloatingPoint) as [number, number, number]))

    await movementController.moveToPoint(target, {
      distanceToStopAnimationFromTarget,
      isAnimationEnabled: false,
      isFacingTarget: true,
    })
  },
  FMOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const actorId = STACK.pop() as number

    await movementController.moveToObject(`entity--${actorId}`, scene, {
      distanceToStopAnimationFromTarget,
      isAnimationEnabled: false,
      isFacingTarget: true,
    })
  },
  FMOVEP: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const partyMemberId = STACK.pop() as number

    await movementController.moveToObject(`party--${partyMemberId}`, scene, {
      distanceToStopAnimationFromTarget,
      isAnimationEnabled: false,
      isFacingTarget: true,
    })
  },
  FOLLOWOFF: () => {
    useGlobalStore.setState({ isPartyFollowing: false })
  },
  FOLLOWON: () => {
    useGlobalStore.setState({ isPartyFollowing: true })
  },
  FOOTSTEP: ({ currentOpcode, STACK }) => {
    const footstepSoundId = STACK.pop() as number
    console.log(currentOpcode.param, footstepSoundId)
  },
  FOOTSTEPCOPY: dummiedCommand,
  FOOTSTEPCUT: ({ movementController }) => {
    movementController.resetFootsteps()
  },
  FOOTSTEPOFF: ({ movementController }) => {
    movementController.disableFootsteps()
  },

  FOOTSTEPOFFALL: () => {},

  FOOTSTEPON: ({ movementController }) => {
    movementController.enableFootsteps()
  },

  GAMEOVER: ({ STACK }) => {
    STACK.pop() as number
    console.error('GAME OVER WHAT DID YOU DO')
  },

  GETCARD: ({ STACK }) => {
    STACK.pop() as number
  },

  GETDRESS: unusedCommand,

  GETHP: unusedCommand,
  GETINFO: ({ scene, script, TEMP_STACK }) => {
    const entity = getScriptEntity(scene, script.groupId)
    if (!entity) {
      console.warn('Entity not found', script.groupId)
      return
    }
    const position = entity.getWorldPosition(new Vector3())

    TEMP_STACK[0] = floatingPointToNumber(position.x)
    TEMP_STACK[1] = floatingPointToNumber(position.y)
    TEMP_STACK[2] = floatingPointToNumber(position.z)
  },
  GETPARTY: ({ STACK, TEMP_STACK }) => {
    const index = STACK.pop() as number
    TEMP_STACK[0] = useGlobalStore.getState().party[index]
  },

  GETTIMER: ({ currentState, TEMP_STACK }) => {
    TEMP_STACK[0] = currentState.countdownTime
  },
  GJMP: unusedCommand,
  HALT: () => {
    return -2
  },
  HASITEM: ({ STACK }) => {
    STACK.pop() as number
    STACK.push(1)
  },
  HIDE: ({ setState }) => {
    setState({ isVisible: false })
  },

  HOLD: ({ STACK }) => {
    STACK.splice(-3)
  },
  HOWMANYCARD: ({ STACK }) => {
    STACK.pop() as number
  },
  IDLOCK: ({ currentOpcode }) => {
    const currentLockedTriangles = useGlobalStore.getState().lockedTriangles
    useGlobalStore.setState({
      lockedTriangles: [...currentLockedTriangles, currentOpcode.param],
    })
  },
  IDUNLOCK: ({ currentOpcode }) => {
    const currentLockedTriangles = useGlobalStore.getState().lockedTriangles
    useGlobalStore.setState({
      lockedTriangles: currentLockedTriangles.filter((id) => id !== currentOpcode.param),
    })
  },
  INITSOUND: () => {},

  INITTRACE: () => {},
  ISMEMBER: unusedCommand,
  ISPARTY: ({ STACK, TEMP_STACK }) => {
    const characterID = STACK.pop() as number
    const indexInParty = useGlobalStore.getState().party.indexOf(characterID)
    TEMP_STACK[0] = indexInParty
  },
  ISTOUCH: ({ scene, script, STACK, TEMP_STACK }) => {
    const actorId = STACK.pop() as number
    const isTouch = isTouching(script.groupId, `entity--${actorId}`, scene)

    TEMP_STACK[0] = isTouch ? 1 : 0
  },
  JMP: ({ currentOpcode, opcodes }) => {
    const targetLabelIndex = opcodes.findIndex((opcode) => opcode.name === `LABEL${currentOpcode.param}`)
    return targetLabelIndex
  },
  JOIN: () => {
    useGlobalStore.setState({
      isPartyFollowing: true,
    })
  },
  JPF: ({ currentOpcode, opcodes, STACK }) => {
    const condition = STACK.pop() as number
    if (condition === 0) {
      return opcodes.findIndex((opcode) => opcode.name === `LABEL${currentOpcode.param}`)
    }
  },
  JUMP: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const target = vectorToFloatingPoint({ x, y, z })

    movementController.jumpToPosition(target, duration)
  },
  JUMP3: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const target = vectorToFloatingPoint({ x, y, z })

    movementController.jumpToPosition(target, duration)
  },
  JUNCTION: ({ STACK }) => {
    const isNowLaguna = (STACK.pop() as number) === 1
    useGlobalStore.setState((state) => ({
      ...state,
      party: isNowLaguna ? [8, 9, 10] : [...state.sleepingParty],
      sleepingParty: isNowLaguna ? [...state.party] : [],
    }))
  },

  KEY: ({ STACK }) => {
    STACK.pop() as number
  },
  KEYON: async ({ currentOpcodeIndex, STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS)
    if (isDown) {
      return currentOpcodeIndex + 2
    }
  },

  KEYON2: unusedCommand,
  KEYSCAN: ({ STACK, TEMP_STACK }) => {
    const key = STACK.pop() as keyof typeof KEY_FLAGS
    const isDown = wasKeyPressed(key)
    TEMP_STACK[0] = isDown ? 1 : 0
  },
  KEYSCAN2: ({ STACK, TEMP_STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS)
    TEMP_STACK[0] = isDown ? 1 : 0
  },
  KEYSIGHNCHANGE: ({ STACK }) => {
    STACK.pop() as number
  },

  KILLBAR: ({ STACK }) => {
    STACK.pop() as number
  },
  KILLTIMER: ({ currentState, setState }) => {
    window.clearTimeout(currentState.countdownTimer)
    setState({
      countdownTimer: undefined,
    })
  },
  LADDERANIME: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const startFrame = STACK.pop() as number
    const endFrame = STACK.pop() as number

    animationController.setLadderAnimation(animationId, startFrame, endFrame)
  },
  LADDERDOWN: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param)
    STACK.splice(-4)
  },
  LADDERDOWN2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3))
    const middle = vectorToFloatingPoint(STACK.splice(-3))
    vectorToFloatingPoint(STACK.splice(-3))

    await handleLadder(animationController, movementController, middle, end, false)
  },
  LADDERUP: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param)
    STACK.splice(-4)
  },
  LADDERUP2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3))
    const middle = vectorToFloatingPoint(STACK.splice(-3))
    vectorToFloatingPoint(STACK.splice(-3))

    await handleLadder(animationController, movementController, middle, end, true)
  },
  LASTIN: ({ STACK }) => {
    STACK.pop() as number
  },
  LASTOUT: dummiedCommand,
  LBL: dummiedCommand,
  LINEOFF: ({ setState }) => {
    setState({ isLineOn: false })
  },
  LINEON: ({ setState }) => {
    setState({ isLineOn: true })
  },

  LOADSYNC: () => {},
  LOFFSET: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    movementController.moveToOffset(x, y, z, duration)
  },
  LOFFSETS: async ({ movementController, STACK }) => {
    const duration = STACK.pop() as number
    const endZ = STACK.pop() as number
    const endY = STACK.pop() as number
    const endX = STACK.pop() as number
    const startZ = STACK.pop() as number
    const startY = STACK.pop() as number
    const startX = STACK.pop() as number

    await movementController.moveToOffset(startX, startY, startZ, 0)
    movementController.moveToOffset(endX, endY, endZ, duration)
  },
  LSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    setCameraScroll(x, y, duration, 'level')
  },
  LSCROLL2: ({ STACK }) => {
    const duration = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const layerID = STACK.pop() as number

    setLayerScroll(layerID, x, y, duration, 'level')
  },
  LSCROLL3: async ({ STACK }) => {
    const duration = STACK.pop() as number
    const endY = STACK.pop() as number
    const endX = STACK.pop() as number
    const startY = STACK.pop() as number
    const startX = STACK.pop() as number

    const layerID = STACK.pop() as number

    setLayerScroll(layerID, -startX, -startY, 0, 'level')
    setLayerScroll(layerID, -endX, -endY, duration, 'level')
  },

  LSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number
    const actorCode = STACK.pop() as number

    const mesh = getScriptEntity(scene, actorCode)
    setCameraAndLayerFocus(mesh, duration)
  },
  LSCROLLA2: unusedCommand,

  LSCROLLP: ({ scene, STACK }) => {
    const duration = STACK.pop() as number
    const partyMemberId = STACK.pop() as number

    const mesh = getPartyMemberModelComponent(scene, partyMemberId)
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' LSCROLLP')
      return
    }
    setCameraAndLayerFocus(mesh, duration)
  },
  LSCROLLP2: unusedCommand,
  LTURN: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    await rotationController.turnToFaceAngle(angle, duration)
  },
  LTURNL: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    await rotationController.turnToFaceAngle(angle, duration, 'left')
  },
  LTURNR: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    await rotationController.turnToFaceAngle(angle, duration, 'right')
  },
  MACCEL: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
    STACK.pop() as number
    STACK.pop() as number
    STACK.pop() as number
  },
  MAPFADEOFF: () => {
    useGlobalStore.setState({ isMapFadeEnabled: false })
  },
  MAPFADEON: () => {
    useGlobalStore.setState({ isMapFadeEnabled: true })
  },
  MAPJUMP: ({ STACK }) => {
    const mapJumpDetailsInMemory = STACK.splice(-4)

    useGlobalStore.setState({
      pendingCharacterPosition: vectorToFloatingPoint(
        mapJumpDetailsInMemory.slice(1, 4) as unknown as [number, number, number],
      ),
      pendingFieldId: MAP_NAMES[mapJumpDetailsInMemory[0]],
    })
  },
  MAPJUMP3: ({ STACK }) => {
    const mapJumpDetailsInMemory = STACK.splice(-5)

    useGlobalStore.setState({
      initialAngle: mapJumpDetailsInMemory[4],
      pendingCharacterPosition: vectorToFloatingPoint(
        mapJumpDetailsInMemory.slice(1, 4) as unknown as [number, number, number],
      ),
      pendingFieldId: MAP_NAMES[mapJumpDetailsInMemory[0]],
    })
  },
  MAPJUMPO: ({ STACK }) => {
    STACK.pop() as number
    const fieldId = STACK.pop() as number

    useGlobalStore.setState({
      pendingFieldId: MAP_NAMES[fieldId],
    })
  },
  MAPJUMPOFF: () => {
    useGlobalStore.setState({ isMapJumpEnabled: false })
  },

  MAPJUMPON: () => {
    useGlobalStore.setState({ isMapJumpEnabled: true })
  },
  MENUDISABLE: dummiedCommand,
  MENUENABLE: dummiedCommand,
  MENUNAME: ({ STACK }) => {
    STACK.pop() as number
  },
  MENUNORMAL: dummiedCommand,
  MENUPHS: dummiedCommand,
  MENUSAVE: dummiedCommand,
  MENUSHOP: async ({ STACK }) => {
    STACK.pop() as number
    await openMessage(
      'shop',
      ['Shop not implemented.'],
      {
        channel: 0,
        height: undefined,
        width: undefined,
        x: 20,
        y: 20,
      },
      true,
      undefined,
    )
  },
  MENUTIPS: ({ STACK }) => {
    STACK.pop() as number
  },

  MENUTUTO: () => {},
  MES: async ({ currentState, STACK }) => {
    const id = STACK.pop() as number
    const channel = STACK.pop() as number

    const { height, width, x, y } = currentState.winSize[channel]

    displayMessage(id, x, y, channel, width, height, false)
  },
  MESFORCUS: unusedCommand,
  MESMODE: ({ STACK }) => {
    const color = STACK.pop() as number
    const mode = STACK.pop() as number
    const channel = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      messageStyles: {
        ...state.messageStyles,
        [channel]: {
          color,
          mode,
        },
      },
    }))
  },
  MESSYNC: async ({ STACK }) => {
    const channel = STACK.pop() as number

    while (useGlobalStore.getState().currentMessages.some((message) => message.placement.channel === channel)) {
      const messagesOnChannel = useGlobalStore
        .getState()
        .currentMessages.filter((message) => message.placement.channel === channel)
      if (!messagesOnChannel[0].isCloseable) {
        enableMessageToClose(messagesOnChannel[0].id)
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  MESVAR: ({ STACK }) => {
    const value = STACK.pop() as number
    const id = STACK.pop() as number
    MESSAGE_VARS[id] = value.toString()
  },
  MESW: ({ STACK }) => {
    STACK.splice(-2)
  },
  MLIMIT: ({ STACK }) => {
    STACK.pop() as number
  },
  MOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const lastThree = STACK.splice(-3)
    const target = new Vector3(...(lastThree.map(numberToFloatingPoint) as [number, number, number]))

    await movementController.moveToPoint(target, {
      distanceToStopAnimationFromTarget,
    })
  },
  MOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const actorId = STACK.pop() as number

    await movementController.moveToObject(`entity--${actorId}`, scene, {
      distanceToStopAnimationFromTarget,
    })
  },
  MOVECANCEL: ({ movementController, STACK }) => {
    STACK.pop() as number
    movementController.stop()
  },
  MOVEFLUSH: ({ movementController }) => {
    movementController.stop()
  },
  MOVESYNC: async ({ movementController }) => {
    while (movementController.getState().position.waypoints) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  MOVIE: () => {
    MEMORY['80'] = 0
    const interval = setInterval(() => {
      MEMORY['80'] += 100
      if (MEMORY['80'] > 3000) {
        clearInterval(interval)
      }
    }, 1000 / 30)
  },
  MOVIECUT: unusedCommand,
  MOVIEREADY: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  MOVIESYNC: dummiedCommand, // used to sync with a movie, we do not show movies so this is dummied and returns done immediately
  MSPEED: ({ movementController, STACK }) => {
    const movementSpeed = STACK.pop() as number
    movementController.setMovementSpeed(movementSpeed)
  },
  MUSICCHANGE: () => {
    musicController.playMusic()
  },
  MUSICLOAD: ({ STACK }) => {
    const id = STACK.pop() as keyof typeof MUSIC_IDS
    musicController.preloadMusic(MUSIC_IDS[id])
  },
  MUSICREPLAY: () => {},
  MUSICSKIP: ({ STACK }) => {
    STACK.pop() as number
  },
  MUSICSTATUS: ({ TEMP_STACK }) => {
    const isPlaying = useGlobalStore.getState().backgroundMusic?.playing() ? 1 : 0
    TEMP_STACK[0] = isPlaying
  },
  MUSICSTOP: ({ STACK }) => {
    const channel = STACK.pop() as 0 | 1
    musicController.pauseChannel(channel)
  },
  MUSICVOL: ({ STACK }) => {
    const channel = STACK.pop() as number
    const volume = STACK.pop() as number
    musicController.setVolume(channel, volume)
  },
  MUSICVOLFADE: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
    STACK.pop() as number
    STACK.pop() as number
  },

  MUSICVOLSYNC: () => {},
  MUSICVOLTRANS: ({ STACK }) => {
    const volume = STACK.pop() as number
    const duration = STACK.pop() as number
    const channel = STACK.pop() as number

    musicController.transitionVolume(channel, volume, duration)
  },
  NOP: unusedCommand,
  OFFSETSYNC: async ({ movementController }) => {
    while (movementController.getState().offset.goal) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  OPENEYES: unusedCommand,
  PARTICLEOFF: ({ STACK }) => {
    STACK.pop() as number
  },

  PARTICLEON: ({ STACK }) => {
    STACK.pop() as number
  },
  PARTICLESET: ({ STACK }) => {
    STACK.pop() as number
  },
  PCOPYINFO: unusedCommand,

  PCTURN: ({ rotationController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const partyMemberId = STACK.pop() as number
    rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration)
  },
  PDIRA: ({ scene, STACK }) => {
    const partyMemberId = STACK.pop() as number
    const player = getPartyMemberModelComponent(scene, partyMemberId)
    if (!player) {
      console.warn('No player found for party member ID', partyMemberId)
      return
    }
    STACK.push((player.userData.rotationController as HandlerArgs['rotationController']).getState().angle.get())
  },
  PGETINFO: ({ scene, script, STACK, TEMP_STACK }) => {
    const partyMemberId = STACK.pop() as number
    const mesh = getPartyMemberModelComponent(scene, partyMemberId)

    if (!mesh) {
      console.warn(script, 'No mesh found for actor ID', partyMemberId)
      return
    }

    const position = mesh.getWorldPosition(new Vector3())
    const { x, y, z } = position

    TEMP_STACK[0] = floatingPointToNumber(x)
    TEMP_STACK[1] = floatingPointToNumber(y)
    TEMP_STACK[2] = floatingPointToNumber(z)
  },
  PHSENABLE: ({ STACK }) => {
    STACK.pop() as number
  },
  PHSPOWER: ({ STACK }) => {
    STACK.pop() as number
  },
  PJUMPA: ({ movementController, scene, STACK }) => {
    const actorId = STACK.pop() as number
    const player = getPartyMemberModelComponent(scene, actorId)
    if (!player) {
      console.warn('No player found for party member ID', actorId)
      return
    }

    const targetPoint = player.getWorldPosition(new Vector3())

    movementController.jumpToPosition(targetPoint, 32)
  },

  PLTURN: async ({ rotationController, scene }) => {
    await rotationController.turnToFaceEntity(`party--0`, scene, 0)
  },
  PMOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const partyMemberId = STACK.pop() as number

    await movementController.moveToObject(`party--${partyMemberId}`, scene, {
      distanceToStopAnimationFromTarget,
    })
  },
  PMOVECANCEL: () => {},
  POLYCOLOR: ({ setState, STACK }) => {
    const blue = STACK.pop() as number
    const green = STACK.pop() as number
    const red = STACK.pop() as number

    setState({
      meshTintColor: [red, green, blue],
    })
  },
  POLYCOLORALL: ({ STACK }) => {
    const blue = STACK.pop() as number
    const green = STACK.pop() as number
    const red = STACK.pop() as number

    useGlobalStore.setState({
      globalMeshTint: [red, green, blue],
    })
  },
  POPANIME: () => {},
  POPI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    TEMP_STACK[currentOpcode.param] = STACK.pop() as number
  },
  POPM_B: ({ currentOpcode, STACK }) => {
    const value = STACK.pop() as number
    MEMORY[currentOpcode.param] = value
  },
  POPM_L: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number
  },
  POPM_W: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number
  },

  PREMAPJUMP: ({ STACK }) => {
    STACK.splice(-4)
  },
  PREMAPJUMP2: ({ STACK }) => {
    STACK.pop() as number
  },

  PREQ: ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number
    const label = STACK.pop() as number
    const priority = STACK.pop() as number
    console.log('PREQ', partyMemberIndex, label, priority)
    remoteExecutePartyMember(scene, partyMemberIndex, label, priority)
  },
  PREQEW: async ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number
    const label = STACK.pop() as number
    const priority = STACK.pop() as number
    console.log('start preqew', partyMemberIndex, label, priority)
    await remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true)
    console.log('end preqew', partyMemberIndex, label, priority)
  },
  PREQSW: ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number
    const label = STACK.pop() as number
    const priority = STACK.pop() as number
    remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true)
  },
  PSHAC: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param)
  },

  PSHI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    STACK.push(TEMP_STACK[currentOpcode.param] ?? 0)
  },
  PSHM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PSHM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PSHM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PSHN_L: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param)
  },
  PSHSM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PSHSM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PSHSM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0)
  },
  PUSHANIME: () => {},
  PUSHOFF: ({ setState }) => {
    setState({
      isPushable: false,
    })
  },
  PUSHON: ({ setState }) => {
    setState({
      isPushable: true,
    })
  },
  PUSHRADIUS: ({ setState, STACK }) => {
    const radius = STACK.pop() as number
    setState({
      pushRadius: radius,
    })
  },
  RAMESW: async ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const id = STACK.pop() as number
    const channel = STACK.pop() as number

    displayMessage(id, x, y, channel)
  },
  RANIME: ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param

    animationController.playAnimation(animationId)
  },
  RANIMEKEEP: ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param

    animationController.playAnimation(animationId, {
      shouldHoldLastFrame: true,
    })
  },
  RANIMELOOP: ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param

    animationController.playAnimation(animationId, {
      isLooping: true,
    })
  },
  RBGANIME: ({ script, STACK }) => {
    const end = STACK.pop() as number
    const start = STACK.pop() as number

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId]
    const lerpValue = new LerpValue(start, SPEEDS.BG)
    const duration = lerpValue.calculateDuration(speed)
    lerpValue.start(end, duration, 0)

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue,
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true,
      },
    })
  },
  RBGANIMELOOP: ({ script, STACK }) => {
    const end = STACK.pop() as number
    const start = STACK.pop() as number

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId]
    const lerpValue = new LerpValue(start, SPEEDS.BG)
    const duration = lerpValue.calculateDuration(speed)
    lerpValue.start(end, duration, 0, true)

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue,
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true,
      },
    })
  },
  RBGSHADELOOP: ({ script, STACK }) => {
    const holdOut = STACK.pop() as number
    const holdIn = STACK.pop() as number
    const endBlue = STACK.pop() as number
    const endGreen = STACK.pop() as number
    const endRed = STACK.pop() as number
    const startBlue = STACK.pop() as number
    const startGreen = STACK.pop() as number
    const startRed = STACK.pop() as number
    const durationOut = STACK.pop() as number
    const durationIn = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      layerTints: {
        ...state.layerTints,
        [script.backgroundParamId]: {
          durationIn,
          durationOut,
          endBlue,
          endGreen,
          endRed,
          holdIn,
          holdOut,
          isLooping: true,
          startBlue,
          startGreen,
          startRed,
        },
      },
    }))
  },
  RCANIME: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const firstFrame = STACK.pop() as number
    const lastFrame = STACK.pop() as number

    animationController.playAnimation(animationId, {
      endFrame: lastFrame,
      startFrame: firstFrame,
    })
  },
  RCANIMEKEEP: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const firstFrame = STACK.pop() as number
    const lastFrame = STACK.pop() as number

    animationController.playAnimation(animationId, {
      endFrame: lastFrame,
      shouldHoldLastFrame: true,
      startFrame: firstFrame,
    })
  },
  RCANIMELOOP: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param
    const startFrame = STACK.pop() as number
    const endFrame = STACK.pop() as number

    animationController.playAnimation(animationId, {
      endFrame,
      isLooping: true,
      startFrame,
    })
  },
  RCMOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number
    const lastThree = STACK.splice(-3)
    const target = new Vector3(...(lastThree.map(numberToFloatingPoint) as [number, number, number]))

    await movementController.moveToPoint(target, {
      distanceToStopAnimationFromTarget,
      isAllowedToLeaveWalkmesh: true,
      isAnimationEnabled: false,
      isFacingTarget: true,
    })
  },
  REFRESHPARTY: dummiedCommand, // used to ensure party changes are reflected everywhere, afaik
  REQ: ({ STACK }) => {
    const label = STACK.pop() as number
    const priority = STACK.pop()
    remoteExecute(label, priority)
  },
  REQEW: async ({ script, STACK }) => {
    const label = STACK.pop() as number
    const priority = STACK.pop()

    console.log('REQEW', script.name, label, priority)
    await remoteExecute(label, priority, true)
  },
  REQSW: ({ STACK }) => {
    const label = STACK.pop() as number
    const priority = STACK.pop()
    remoteExecute(label, priority, true)
  },
  RESETGF: ({ STACK }) => {
    STACK.pop() as number
  },
  REST: dummiedCommand, // heal party and GFs
  RET: () => {
    return -1
  },
  RFACEDIR: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number
    const z = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number

    const directionVector = vectorToFloatingPoint({ x, y, z })
    await headController.turnToFaceDirection(directionVector, duration)
  },

  RFACEDIRA: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const targetActorId = STACK.pop() as number
    await headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration)
  },
  RFACEDIRI: unusedCommand,
  RFACEDIROFF: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number
    await headController.turnToFaceAngle(0, duration)
  },
  RFACEDIRP: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number
    const partyMemberId = STACK.pop() as number
    await headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration)
  },
  RFMOVE: async (args) => {
    OPCODE_HANDLERS?.FMOVE?.(args)
  },
  RMOVE: (args) => {
    OPCODE_HANDLERS?.MOVE?.(args)
  },
  RMOVEA: async (args) => {
    OPCODE_HANDLERS?.MOVEA?.(args)
  },
  RND: ({ TEMP_STACK }) => {
    TEMP_STACK[0] = Math.round(Math.random() * 255)
  },
  RPMOVEA: async (args) => {
    OPCODE_HANDLERS?.PMOVEA?.(args)
  },
  RUNDISABLE: () => {
    useGlobalStore.setState({ isRunEnabled: false })
  },
  RUNENABLE: () => {
    useGlobalStore.setState({ isRunEnabled: true })
  },
  SARALYDISPOFF: dummiedCommand,
  SARALYDISPON: dummiedCommand,
  SARALYOFF: dummiedCommand,
  SARALYON: dummiedCommand,
  SAVEENABLE: ({ STACK }) => {
    STACK.pop() as number
  },
  SCROLLMODE2: ({ STACK }) => {
    const lastFive = STACK.splice(-5)
    const layerIndex = lastFive[0]
    const xOffset = lastFive[1]
    const yOffset = lastFive[2]
    const xScrollSpeed = lastFive[3]
    const yScrollSpeed = lastFive[4]

    const controlledScroll = useGlobalStore.getState().layerScrollAdjustments[layerIndex] ?? {
      xOffset: 0,
      xScrollSpeed: 0,
      yOffset: 0,
      yScrollSpeed: 0,
    }

    controlledScroll.xOffset = xOffset
    controlledScroll.yOffset = yOffset
    controlledScroll.xScrollSpeed = xScrollSpeed
    controlledScroll.yScrollSpeed = yScrollSpeed

    useGlobalStore.setState({
      layerScrollAdjustments: {
        ...useGlobalStore.getState().layerScrollAdjustments,
        [layerIndex]: controlledScroll,
      },
    })
  },
  SCROLLRATIO2: ({ STACK }) => {
    const y = STACK.pop() as number
    const x = STACK.pop() as number
    const layer = STACK.pop() as number

    useGlobalStore.setState({
      backgroundScrollRatios: {
        ...useGlobalStore.getState().backgroundScrollRatios,
        [layer]: {
          x,
          y,
        },
      },
    })
  },
  SCROLLSYNC: async () => {
    while (
      useGlobalStore.getState().cameraScrollOffset.isInProgress ||
      Object.values(useGlobalStore.getState().layerScrollOffsets).some((transition) => transition.isInProgress) ||
      useGlobalStore.getState().cameraFocusSpring?.isAnimating
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  SCROLLSYNC2: async ({ STACK }) => {
    const layerID = STACK.pop() as number

    while (
      useGlobalStore.getState().layerScrollOffsets[layerID] &&
      useGlobalStore.getState().layerScrollOffsets[layerID].isInProgress
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  SEALEDOFF: ({ STACK }) => {
    STACK.pop() as number
  },
  SEPOS: ({ sfxController, STACK }) => {
    const pan = STACK.pop() as number
    const channel = STACK.pop() as number

    sfxController.setPan(channel, pan)
  },
  SEPOSTRANS: ({ sfxController, STACK }) => {
    const pan = STACK.pop() as number
    const duration = STACK.pop() as number
    const channel = STACK.pop() as number

    sfxController.setPan(channel, pan, duration)
  },
  SESTOP: ({ sfxController, STACK }) => {
    const channel = STACK.pop() as number
    sfxController.stop(channel)
  },
  SET: ({ currentOpcode, movementController, STACK }) => {
    const lastTwo = STACK.splice(-2)
    const knownPosition = lastTwo.map(numberToFloatingPoint) as [number, number]
    const vector = new Vector3(knownPosition[0], knownPosition[1], 0)

    const walkmeshController = useGlobalStore.getState().walkmeshController
    if (!walkmeshController) {
      console.warn('No walkmesh controller')
      return
    }

    const position = walkmeshController.getPositionOnWalkmesh(vector)
    if (!position) {
      console.warn('Position not found on walkmesh', vector)
      return
    }

    movementController.setPosition(position, currentOpcode.param)
  },
  SET3: async ({ currentOpcode, movementController, STACK }) => {
    const lastThree = STACK.splice(-3)
    const position = new Vector3(...(lastThree.map(numberToFloatingPoint) as [number, number, number]))
    movementController.setPosition(position, currentOpcode.param)
  },
  SETBAR: ({ STACK }) => {
    STACK.splice(-2)
  },
  SETBATTLEMUSIC: ({ STACK }) => {
    const musicId = STACK.pop() as number
    musicController.setBattleMusic(musicId)
  },
  SETCAMERA: ({ STACK }) => {
    useGlobalStore.setState({
      activeCameraId: STACK.pop() as number,
    })
  },
  SETCARD: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },

  SETDCAMERA: ({ STACK }) => {
    STACK.pop() as number
  },
  SETDRAWPOINT: ({ setState, STACK }) => {
    const isDrawPoint = STACK.pop() as number
    setState({ isDrawPoint: Boolean(isDrawPoint) })
  },

  SETDRESS: ({ STACK }) => {
    const outfitId = STACK.pop() as number
    const playerId = STACK.pop() as number
    console.log('Set dress:', { outfitId, playerId })
    MEMORY[720 + playerId] = outfitId
  },
  SETGETA: ({ STACK }) => {
    STACK.pop() as number
  },
  SETHP: ({ STACK }) => {
    STACK.splice(-2)
  },
  SETLINE: ({ setState, STACK }) => {
    const linePointsInMemory = STACK.splice(-6)
    setState({
      linePoints: [
        vectorToFloatingPoint(linePointsInMemory.slice(0, 3)),
        vectorToFloatingPoint(linePointsInMemory.slice(3)),
      ],
    })
  },
  SETMESSPEED: ({ STACK }) => {
    STACK.pop() as number
    STACK.pop() as number
  },
  SETMODEL: ({ currentOpcode, setState }) => {
    const modelId = currentOpcode.param

    setState({
      modelId,
    })
  },
  SETODIN: dummiedCommand,
  SETPARTY: ({ STACK }) => {
    const character3ID = STACK.pop() as number
    const character2ID = STACK.pop() as number
    const character1ID = STACK.pop() as number

    const uniqueParty = Array.from(new Set([character1ID, character2ID, character3ID])).filter((id) => id !== 255)

    useGlobalStore.setState({
      party: uniqueParty,
    })
  },

  SETPARTY2: unusedCommand,
  SETPC: ({ setState, STACK }) => {
    const partyMemberId = STACK.pop() as number
    setState({
      partyMemberId,
    })
  },
  SETPLACE: ({ STACK }) => {
    const placeName = STACK.pop() as number
    useGlobalStore.setState({ currentLocationPlaceName: placeName })
  },
  SETROOTTRANS: ({ STACK }) => {
    STACK.pop() as number
  },
  SETTIMER: ({ currentState, setState, STACK }) => {
    const time = STACK.pop() as number

    const timer = window.setTimeout(() => {
      setState((state) => ({
        countdownTime: state.countdownTime - 1,
      }))
      console.log(currentState.countdownTime)
      if (currentState.countdownTime <= 0) {
        window.clearTimeout(currentState.countdownTimer)
        setState({
          countdownTimer: undefined,
        })
      }
    }, 1000)

    setState({
      countdownTime: time,
      countdownTimer: timer,
    })
  },

  SETVIBRATE: ({ STACK }) => {
    STACK.splice(-2)
  },

  SETWITCH: ({ STACK }) => {
    STACK.pop() as number
  },
  SEVOL: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number
    const channel = STACK.pop() as number

    sfxController.setVolume(channel, volume)
  },
  SEVOLTRANS: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number
    const duration = STACK.pop() as number
    const channel = STACK.pop() as number

    sfxController.setVolume(channel, volume, duration)
  },

  SHADEFORM: ({ STACK }) => {
    STACK.splice(-8)
  },
  SHADELEVEL: ({ STACK }) => {
    STACK.pop() as number
  },
  SHADESET: ({ STACK }) => {
    STACK.pop() as number
  },
  SHADETIMER: unusedCommand,
  SHAKE: ({ STACK }) => {
    STACK.splice(-4)
  },
  SHAKEOFF: () => {},
  SHOW: ({ setState }) => {
    setState({ isVisible: true })
  },
  SPLIT: async ({ scene, STACK }) => {
    useGlobalStore.setState({
      isPartyFollowing: false,
    })

    const controllerPromises: Promise<void>[] = []
    const member1 = getPartyMemberModelComponent(scene, 0)
    const member1MovementController = member1!.userData.movementController as ReturnType<
      typeof createMovementController
    >
    const member1Position = vectorToFloatingPoint(STACK.splice(-3))
    member1MovementController.setMovementSpeed(2560)
    console.log('Moving member1', 'from', member1MovementController.getPosition(), 'to', member1Position)
    controllerPromises.push(member1MovementController.moveToPoint(member1Position))

    const member2 = getPartyMemberModelComponent(scene, 1)
    if (member2) {
      const member2MovementController = member2!.userData.movementController as ReturnType<
        typeof createMovementController
      >
      const member2Position = vectorToFloatingPoint(STACK.splice(-3))
      member2MovementController.setMovementSpeed(2560)
      console.log('Moving member2', 'from', member2MovementController.getPosition(), 'to', member2Position)
      member2MovementController.moveToPoint(member2Position)
      controllerPromises.push(member2MovementController.moveToPoint(member2Position))
    }

    const member3 = getPartyMemberModelComponent(scene, 2)
    if (member3) {
      const member3MovementController = member3!.userData.movementController as ReturnType<
        typeof createMovementController
      >
      const member3Position = vectorToFloatingPoint(STACK.splice(-3))
      member3MovementController.setMovementSpeed(2560)
      console.log('Moving member3', 'from', member3MovementController.getPosition(), 'to', member3Position)
      controllerPromises.push(member3MovementController.moveToPoint(member3Position))
    }

    await Promise.all(controllerPromises)
  },
  SPUREADY: ({ STACK }) => {
    const startTime = STACK.pop() as number
    useGlobalStore.setState({ spuValue: startTime })
    const tick = () => {
      useGlobalStore.setState((state) => ({ ...state, spuValue: state.spuValue + 1 }))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  },
  SPUSYNC: async ({ STACK }) => {
    const frames = STACK.pop() as number
    while (useGlobalStore.getState().spuValue < frames) {
      console.log('Waiting for SPU sync', useGlobalStore.getState().spuValue, frames)
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  },
  STOPVIBRATE: unusedCommand,
  SUBMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number
    useGlobalStore.setState({
      availableCharacters: useGlobalStore.getState().availableCharacters.filter((id) => id !== characterID),
      party: useGlobalStore.getState().party.filter((id) => id !== characterID),
    })
  },
  SUBPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number
    useGlobalStore.setState({
      party: useGlobalStore.getState().party.filter((id) => id !== characterID),
    })
  },
  SWAP: dummiedCommand, // swap party members, works across whole party so probably for Laguna scenes

  TALKOFF: ({ setState }) => {
    setState({
      isTalkable: false,
    })
  },
  TALKON: ({ setState }) => {
    setState({
      isTalkable: true,
    })
  },
  TALKRADIUS: ({ setState, STACK }) => {
    const radius = STACK.pop() as number
    setState({
      talkRadius: radius,
    })
  },
  TCOLADD: ({ STACK }) => {
    const duration = STACK.pop() as number
    const blue = STACK.pop() as number
    const green = STACK.pop() as number
    const red = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      ...state,
      colorOverlay: {
        ...state.colorOverlay,
        duration,
        endBlue: blue,
        endGreen: green,
        endRed: red,
        type: 'additive',
      },
      isTransitioningColorOverlay: true,
    }))
  },
  TCOLSUB: ({ STACK }) => {
    const duration = STACK.pop() as number
    const blue = STACK.pop() as number
    const green = STACK.pop() as number
    const red = STACK.pop() as number

    useGlobalStore.setState((state) => ({
      ...state,
      colorOverlay: {
        ...state.colorOverlay,
        duration,
        endBlue: blue,
        endGreen: green,
        endRed: red,
        type: 'subtractive',
      },
      isTransitioningColorOverlay: true,
    }))
  },

  THROUGHOFF: ({ setState }) => {
    setState({ isSolid: true })
  },
  THROUGHON: ({ setState }) => {
    setState({ isSolid: false })
  },
  TUTO: ({ STACK }) => {
    STACK.pop() as number
  },
  UCOFF: () => {
    useGlobalStore.setState({ isUserControllable: false })
  },
  UCON: () => {
    useGlobalStore.setState({ isUserControllable: true })
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN1: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN2: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN3: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN4: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN6: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    rotationController.turnToFaceAngle(angle, duration)
  },
  UNKNOWN7: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    rotationController.turnToFaceAngle(angle, duration)
  },
  UNKNOWN8: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    rotationController.turnToFaceAngle(angle, duration)
  },
  UNKNOWN9: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number
    const angle = STACK.pop() as number
    rotationController.turnToFaceAngle(angle, duration)
  },
  UNKNOWN10: dummiedCommand,
  UNKNOWN11: async ({ rotationController, STACK }) => {
    const startAngle = STACK.pop() as number
    const endAngle = STACK.pop() as number
    await rotationController.turnToFaceAngle(startAngle, 0)
    await rotationController.turnToFaceAngle(endAngle, 0)
  }, // "PIVOT"
  UNKNOWN12: () => {}, // "PIVOT_SYNC"
  UNKNOWN13: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN14: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN15: ({ STACK }) => {
    STACK.pop() as number
  },
  UNKNOWN16: ({ STACK }) => {
    STACK.pop() as number
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN17: ({ STACK }) => {
    STACK.pop() as number
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN18: ({ STACK }) => {
    STACK.pop() as number
  },
  UNUSE: ({ setState }) => {
    setState({ isUnused: true })
  },
  USE: ({ setState }) => {
    setState({ isUnused: false })
  },
  WAIT: async ({ STACK }) => {
    const psxGameFrames = STACK.pop() as number
    await wait((psxGameFrames / 30) * 1000)
  },
  WHERECARD: ({ STACK }) => {
    STACK.pop() as number
  },
  WHOAMI: ({ STACK }) => {
    STACK.pop() as number
  },
  WINCLOSE: ({ STACK }) => {
    const channel = STACK.pop() as number

    const currentMessages = useGlobalStore.getState().currentMessages

    const matchingMessages = currentMessages.filter((message) => message.placement.channel === channel)
    const lastOpenedMessage = matchingMessages[0]
    if (!lastOpenedMessage) {
      console.warn('No message to close')
      return
    }
    closeMessage(lastOpenedMessage.id, undefined)
  },
  WINSIZE: ({ currentState, STACK }) => {
    const height = STACK.pop() as number
    const width = STACK.pop() as number
    const y = STACK.pop() as number
    const x = STACK.pop() as number
    const channel = STACK.pop() as number

    currentState.winSize[channel] = {
      height,
      width,
      x,
      y,
    }
  },
  WORLDMAPJUMP: ({ STACK }) => {
    const val1 = STACK.pop() as number
    const val2 = STACK.pop() as number
    const id = STACK.pop() as number
    const paddedId = id.toString().padStart(2, '0')
    console.log('WORLDMAPJUMP', { id, val1, val2 }, paddedId)
    useGlobalStore.setState({
      pendingFieldId: `wm${paddedId}` as (typeof MAP_NAMES)[number],
    })
  },
}
