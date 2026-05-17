import { Scene, Vector3 } from "three";
import useGlobalStore from "../../../store";
import { floatingPointToNumber, numberToFloatingPoint, vectorToFloatingPoint } from "../../../utils";
import { Opcode, OpcodeObj, Script } from "../types";
import { closeMessage, openMessage, enableMessageToClose, remoteExecute, remoteExecutePartyMember, unusedCommand, wait } from "./utils";
import MAP_NAMES from "../../../constants/maps";
import { getPartyMemberModelComponent, getScriptEntity } from "./Model/modelUtils";
import { displayMessage, isKeyDown, KEY_FLAGS, isTouching, setCameraAndLayerFocus, wasKeyPressed, setCameraScroll, setLayerScroll } from "./common";
import createScriptState, { ScriptState } from "./state";
import { createAnimationController } from "./AnimationController/AnimationController";
import createHeadRotationController from "./HeadRotationController/HeadRotationController";
import createMovementController from "./MovementController/MovementController";
import { MUSIC_IDS } from "../../../constants/audio";
import MusicController from "./MusicController";
import createRotationController from "./RotationController/RotationController";
import createSFXController from "./SFXController/SFXController";
import { DRAW_POINTS } from "../../../constants/drawPoints";
import { preloadSound } from "./SFXController/webAudio";
import { handleLadder } from "./MovementController/utils";
import LerpValue from "../../../LerpValue";
import { SPEEDS } from "../../../constants/speeds";
import { framesToMs, MS_PER_FRAME } from "../../../timing";


const dummiedCommand = () => { }
const unusedCommand = () => { }


export const musicController = MusicController();

type HandlerArgs = {
  animationController: ReturnType<typeof createAnimationController>,
  currentOpcode: OpcodeObj,
  currentOpcodeIndex: number,
  currentState: Readonly<ScriptState>,
  headController: ReturnType<typeof createHeadRotationController>,
  movementController: ReturnType<typeof createMovementController>,
  rotationController: ReturnType<typeof createRotationController>,
  opcodes: OpcodeObj[],
  scene: Scene,
  script: Script,
  setState: ReturnType<typeof createScriptState>['setState'],
  sfxController: ReturnType<typeof createSFXController>,
  STACK: number[],
  TEMP_STACK: Record<number, number>
}

type HandlerFuncWithPromise = (args: HandlerArgs) => Promise<number | void> | (number | void);

// byte – 0,255
// word – 0,65535
// long – 0,4294967295
// signed byte – -128,127
export let MEMORY: Record<number, number> = {
  72: 9999, // gil
  491: 0, // touk
  641: 96,
  534: 1, // ?
  1024: 0,
  1025: 0,
  
  84: 201, // last area visited

  256: 0, // progress
  528: 0, // subprogress

  720: 0, // squall model
  721: 0, // zell model
  722: 0, // selphie model
  723: 0, // quistis model
};

export const restoreMemory = (savedMemory: typeof MEMORY) => {
  MEMORY = {
    ...savedMemory,
  }
}

export const MESSAGE_VARS: Record<number, string> = {};

export const OPCODE_HANDLERS: Record<Opcode, HandlerFuncWithPromise> = {
  AASK: async ({ STACK, TEMP_STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const cancelOpt = STACK.pop() as number;
    const defaultOpt = STACK.pop() as number;
    const last = STACK.pop() as number;
    const first = STACK.pop() as number;

    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    const { availableMessages } = useGlobalStore.getState();

    const uniqueId = `${id}--${Date.now()}`;

    const result = await openMessage(uniqueId, availableMessages[id], { x, y, channel, width: undefined, height: undefined }, true, {
      first,
      last,
      default: defaultOpt,
      cancel: cancelOpt,
      blocked: undefined
    });
    TEMP_STACK[0] = result;
  },
  // Some sort of styling effect: 0/1/2/3
  ACTORMODE: ({ setState, STACK }) => {
    const mode = STACK.pop() as number;
    setState({
      actorMode: mode
    })
  },
  ADDGIL: ({ STACK }) => {
    const gil = STACK.pop() as number;
    MEMORY[72] += gil;
  },
  ADDITEM: ({ STACK }) => {
    STACK.splice(-2);
  },

  ADDMAGIC: ({ STACK }) => {
    STACK.splice(-3);
  },
  ADDMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      availableCharacters: [...useGlobalStore.getState().availableCharacters, characterID]
    });
  },
  ADDPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState(state => ({
      ...state,
      party: [...state.party, characterID]
    }))
  },
  ADDPASTGIL: ({ STACK }) => {
    STACK.pop() as number;
  },
  ADDSEEDLEVEL: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Set: unused, but manipulate stack. here for completeness
  ALLSEPOS: ({ STACK }) => {
    STACK.splice(-1);
  },
  ALLSEPOSTRANS: ({ STACK }) => {
    STACK.pop() as number; // duration (not applied — MP3 stack has no global pan ramp)
    STACK.pop() as number; // pan (not applied)
  },
  ALLSEVOL: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;

    sfxController.setVolume(undefined, volume);
  },
  ALLSEVOLTRANS: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const duration = STACK.pop() as number;

    sfxController.setVolume(undefined, volume, duration);
  },
  AMES: ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    displayMessage(id, x, y, channel, undefined, undefined, false);
  },
  AMESW: async ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    await displayMessage(id, x, y, channel);
  },
  ANGELODISABLE: ({ STACK }) => {
    STACK.pop() as number;
  },
  ANIME: async ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param;

    await animationController.playAnimation(animationId);
  },
  ANIMEKEEP: async ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param;

    await animationController.playAnimation(animationId, {
      shouldHoldLastFrame: true,
    });
  },
  ANIMESPEED: ({ animationController, STACK }) => {
    animationController.setAnimationSpeed(STACK.pop() as number)
  },
  ANIMESTOP: ({ animationController }) => {
    animationController.pauseAnimation(true);
  },
  ANIMESYNC: async ({ animationController }) => {
    while (!animationController.getIsSafeToMoveOn()) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  ASK: (args) => {
    const { STACK } = args;
    // We cannot set x,y with ask, so we spoof it here to reuse AASK
    STACK.push(5);
    STACK.push(5);

    OPCODE_HANDLERS?.AASK?.(args);
  },
  AXIS: ({ STACK }) => {
    STACK.splice(-2);
  },
  AXISSYNC: unusedCommand,
  BASEANIME: ({ animationController, currentOpcode, STACK }) => {
    const standAnimationId = currentOpcode.param;
    const runAnimationId = STACK.pop() as number;
    const walkAnimationId = STACK.pop() as number;

    animationController.setIdleAnimations(standAnimationId, runAnimationId, walkAnimationId);
  },
  BATTLE: async ({ STACK }) => {
    STACK.splice(-2);
  },
  BATTLECUT: dummiedCommand,
  BATTLEMODE: ({ STACK }) => {
    STACK.pop() as number;
  },
  BATTLEOFF: dummiedCommand,

  // Do not touch stack, not relevant to field
  BATTLEON: dummiedCommand,
  BATTLERESULT: dummiedCommand,
  BGANIME: async ({ script, STACK }) => {
    const end = STACK.pop() as number;
    const start = STACK.pop() as number;

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId];
    const lerpValue = new LerpValue(start, SPEEDS.BG);
    const duration = lerpValue.calculateDuration(speed);
    lerpValue.start(end, duration, 0);

    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true
      },
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue
      }
    })
    while (useGlobalStore.getState().backgroundAnimations[script.backgroundParamId]?.isAnimating) {
      if (!useGlobalStore.getState().backgroundAnimations[script.backgroundParamId]) {
        return;
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  BGANIMEFLAG: unusedCommand,
  BGANIMESPEED: ({ script, STACK }) => {
    const speed = STACK.pop() as number;
    useGlobalStore.setState({
      backgroundLayerSpeeds: {
        ...useGlobalStore.getState().backgroundLayerSpeeds,
        [script.backgroundParamId]: speed
      }
    })
  },
  BGANIMESYNC: async ({script}) => {
    while (useGlobalStore.getState().backgroundAnimations[script.backgroundParamId].isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  BGCLEAR: ({ STACK }) => {
    const layerId = STACK.pop() as number; // MAYBE?
  
    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [layerId + 1]: false
      }
    })
  },
  BGDRAW: ({ script, STACK }) => {
    const frame = STACK.pop() as number;

    const lerpValue = new LerpValue(frame, SPEEDS.BG);
    
    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true
      }
    })
  },
  BGOFF: ({ script }) => {
    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: false
      }
    })
  },
  BGSHADE: ({ script, STACK }) => {
    const endBlue = STACK.pop() as number;
    const endGreen = STACK.pop() as number;
    const endRed = STACK.pop() as number;
    const startBlue = STACK.pop() as number;
    const startGreen = STACK.pop() as number;
    const startRed = STACK.pop() as number;
    const duration = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      layerTints: {
        ...state.layerTints,
        [script.backgroundParamId]: {
          durationIn: duration,
          durationOut: 0,
          startRed,
          startGreen,
          startBlue,
          endRed,
          endGreen,
          endBlue,
          holdIn: 0,
          holdOut: 0,
          isLooping: false
        }
      }
    }))
  },
  BGSHADEOFF: dummiedCommand,
  BGSHADESTOP: () => { },
  BLINKEYES: unusedCommand,

  // Completely unknown. Mainly used in cmwood maps?
  BROKEN: ({ STACK }) => {
    STACK.splice(-8);
  },
  CAL: ({ currentOpcode, STACK }) => {
    const value2 = STACK.pop() as number;
    const value1 = STACK.pop() as number;
    if (currentOpcode.param === 0) {
      STACK.push(value1 + value2);
    } else if (currentOpcode.param === 1) {
      STACK.push(value1 - value2);
    } else if (currentOpcode.param === 2) {
      STACK.push(value1 * value2);
    } else if (currentOpcode.param === 3) {
      STACK.push(value1 / value2);
    } else if (currentOpcode.param === 4) {
      STACK.push(value1 % value2);
    } else if (currentOpcode.param === 5) {
      if (value1 !== undefined) {
        STACK.push(value1);
      }
      STACK.push(-value2);
    } else if (currentOpcode.param === 6) {
      STACK.push(value1 === value2 ? 1 : 0);
    } else if (currentOpcode.param === 7) {
      STACK.push(value1 > value2 ? 1 : 0);
    } else if (currentOpcode.param === 8) {
      STACK.push(value1 >= value2 ? 1 : 0);
    } else if (currentOpcode.param === 9) {
      STACK.push(value1 < value2 ? 1 : 0);
    } else if (currentOpcode.param === 10) {
      STACK.push(value1 <= value2 ? 1 : 0);
    } else if (currentOpcode.param === 11) {
      STACK.push(value1 !== value2 ? 1 : 0);
    } else if (currentOpcode.param === 12) {
      STACK.push(value1 & value2);
    } else if (currentOpcode.param === 13) {
      STACK.push(value1 | value2);
    } else if (currentOpcode.param === 14) {
      STACK.push(value1 ^ value2);
    // BITWISENOT is unary: pass value1 through, then push complement of value2.
    } else if (currentOpcode.param === 15) {
      if (value1 !== undefined) {
        STACK.push(value1);
      }
      STACK.push(~value2);
    } else {
      console.warn(`CAL with param ${currentOpcode.param} not implemented.`);
    }
  },
  CANIME: async ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const firstFrame = STACK.pop() as number;
    const lastFrame = STACK.pop() as number;

    await animationController.playAnimation(animationId, {
      startFrame: firstFrame,
      endFrame: lastFrame,
    });
  },
  CANIMEKEEP: async ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const firstFrame = STACK.pop() as number;
    const lastFrame = STACK.pop() as number;

    await animationController.playAnimation(animationId, {
      startFrame: firstFrame,
      endFrame: lastFrame,
      shouldHoldLastFrame: true,
    });
  },
  CARDGAME: ({ STACK }) => {
    STACK.splice(-7);
  },
  CHANGEPARTY: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  CHOICEMUSIC: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  CLEAR: () => {
    MEMORY = {};
  },

  // Touch stack
  CLOSEEYES: dummiedCommand,


  // CMOVE: no turn, no animation
  CMOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const lastThree = STACK.splice(-3);
    const target = new Vector3(...lastThree.map(numberToFloatingPoint) as [number, number, number]);

    await movementController.moveToPoint(target, {
      isAnimationEnabled: false,
      isFacingTarget: false,
      distanceToStopAnimationFromTarget
    });
  },
  COFFSET: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    movementController.moveToOffset(x, y, z, duration);
  },
  COFFSETS: async ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const endZ = STACK.pop() as number;
    const endY = STACK.pop() as number;
    const endX = STACK.pop() as number;
    const startZ = STACK.pop() as number;
    const startY = STACK.pop() as number;
    const startX = STACK.pop() as number;
    await movementController.moveToOffset(startX, startY, startZ, 0)
    movementController.moveToOffset(endX, endY, endZ, duration);
  },
  COLSYNC: async () => { 
    while (useGlobalStore.getState().isTransitioningColorOverlay) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  COPYINFO: ({ STACK }) => {
    STACK.pop() as number;
  },
  CROSSMUSIC: ({ STACK }) => {
    const fadeFrames = STACK.pop() as number;
    const volume = STACK.pop() as number;
    musicController.crossMusic(volume, fadeFrames);
  },
  CSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, duration, 'camera');
  },
  CSCROLL2: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, x, y, duration, 'camera', true);
  },
  // This is never used in a working map (only broken field bg2f_1a)
  CSCROLL3: async ({ STACK }) => {
    const duration = STACK.pop() as number;
    const endY = STACK.pop() as number;
    const endX = STACK.pop() as number;
    const startY = STACK.pop() as number;
    const startX = STACK.pop() as number;
    
    // Pop layer ID from stack
    const layerID = STACK.pop() as number; 

    setLayerScroll(layerID, startX, startY, 0, 'camera');
    setLayerScroll(layerID, endX, endY, duration, 'camera');
  },
  CSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, duration);
  },
  CSCROLLA2: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const actorCode = STACK.pop() as number;
    const layerID = STACK.pop() as number;

    if (layerID !== 0) {
      console.warn('CSCROLLA2: Layer ID is not 0', layerID);
    }

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, duration);
  },
  CSCROLLP: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;

    const mesh = getPartyMemberModelComponent(scene, partyMemberId);
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' CSCROLLP');
      return;
    }
    setCameraAndLayerFocus(mesh, duration);
  },
  CSCROLLP2: unusedCommand,

  // Pause the script while this character does a quick, combat-style turn to
  // look at another character on screen. The turn is snappier than LTURN.
  CTURN: async ({ rotationController, scene, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const targetId = STACK.pop() as number;

    await rotationController.turnToFaceEntity(`entity--${targetId}`, scene, 'fast');
  },

  // Pause the script while this character does a quick, combat-style turn to
  // a specific compass direction. The L/R suffix in the original probably meant "favour
  // turning left/right" but both branches collapse to the shortest path, so we
  // don't pass a direction hint.
  CTURNL: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'fast');
  },
  CTURNR: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'fast');
  },

  DCOLADD: ({ STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      colorOverlay: {
        ...state.colorOverlay,
        duration: 0,
        endRed: red,
        endGreen: green,
        endBlue: blue,
        type: 'additive',
      },
      isTransitioningColorOverlay: true
    }));
  },
  DCOLSUB: ({ STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      colorOverlay: {
        ...state.colorOverlay,
        duration: 0,
        endRed: red,
        endGreen: green,
        endBlue: blue,
        type: 'subtractive',
      },
      isTransitioningColorOverlay: true
    }));
  },
  DEBUG: unusedCommand,
  // Snap this character to face a given compass direction instantly — no
  // turning animation, they just pop to the new orientation.
  DIR: ({ rotationController, STACK }) => {
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, 0);
  },
  // Snap this character to face another character on screen instantly.
  DIRA: ({ rotationController, scene, STACK }) => {
    const targetActorId = STACK.pop() as number;
    rotationController.turnToFaceEntity(`entity--${targetActorId}`, scene, 0);
  },

  // Snap this character to face a specific spot in the world instantly,
  // given as an (x, y, z) point rather than an angle.
  DIRP: ({ rotationController, STACK }) => {
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const worldTarget = vectorToFloatingPoint({ x, y, z });
    rotationController.turnToFaceVector(worldTarget, 0);
  },
  DISC: ({ STACK }) => {
    STACK.pop() as number;
  },
  DISCJUMP: (args) => {
    OPCODE_HANDLERS?.['MAPJUMP3']?.(args);
  },
  DISPBAR: ({ STACK }) => {
    STACK.splice(-7);
  },
  DISPTIMER: ({ STACK }) => {
    // const y = 
    STACK.pop() as number;
    // const x = 
    STACK.pop() as number;
  },

  DOFFSET: async ({ movementController, STACK }) => {
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    await movementController.setOffset(x, y, z);
  },
  DOORLINEOFF: ({ setState }) => {
    setState({ isDoorOn: false, })
  },
  DOORLINEON: ({ setState }) => {
    setState({ isDoorOn: true, })
  },

  DRAWPOINT: async ({ sfxController, STACK }) => {
    const drawPointId = STACK.pop() as number;
    await sfxController.play(66, 0, 127, 128);
    preloadSound(67);
    await openMessage('drawpoint', [`Found a draw point!\n${DRAW_POINTS[drawPointId]} found.`], {
      x: 110,
      y: 90,
      width: 150,
      height: 40,
      channel: 0,
    }, true);
    sfxController.play(67, 0, 127, 128);
  },
  DSCROLL: ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, 0, 'level');
  },
  DSCROLL2: async ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, x, y, 0, 'level');
  },
  DSCROLL3: unusedCommand,
  DSCROLLA: async ({ scene, STACK }) => {
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, 0);
  },
  DSCROLLA2: ({ scene, STACK }) => {
    const actorCode = STACK.pop() as number;
    const layerID = STACK.pop() as number;

    if (layerID !== 0) {
      console.warn('DSCROLLA2: Layer ID is not 0', layerID);
    }

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, 0);
  },

  DSCROLLP: async ({ scene, STACK }) => {
    const partyMemberId = STACK.pop() as number;

    const mesh = getPartyMemberModelComponent(scene, partyMemberId);
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' DSCROLLP');
      return;
    }
    setCameraAndLayerFocus(mesh, 0);
  },
  DSCROLLP2: unusedCommand,
  DUALMUSIC: ({ STACK }) => {
    const volume = STACK.pop() as number; // I think this is a volume value? 0 - 127
    musicController.dualMusic(volume);
  },
  DYING: dummiedCommand, // resurrects dead members to 1hp
  // I think the documentation here is incorrect. I believe this loads banks of sounds. It's used in
  // test maps with long sound lists before triggering effectplay2.
  EFFECTLOAD: ({ STACK }) => {
    const soundBankId = STACK.pop() as number; // note: check docs, apparently not normal
    console.log('EFFECTLOAD', soundBankId); 
    //sfxController.playLoopingEffect(loopingBackgroundEffectId)
  },

  EFFECTPLAY: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const pan = STACK.pop() as number;
    const channel = STACK.pop() as number;
    const sfxId = STACK.pop() as number;
    sfxController.play(sfxId, channel, volume, pan)
  },
  EFFECTPLAY2: ({ currentOpcode, sfxController, STACK }) => {
    const channel = STACK.pop() as number;
    const pan = STACK.pop() as number;
    const rawVolume = STACK.pop() as number;
    const volume = Math.min(Math.max(rawVolume, 0), 127);
    const sfxId = currentOpcode.param;
    sfxController.playFieldSound(sfxId, channel, volume, pan)
  },
  ENDING: unusedCommand,
  FACEDIR: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    headController.turnToFaceWorldPosition(vectorToFloatingPoint({x, y, z}), duration);
  },
  FACEDIRA: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const targetActorId = STACK.pop() as number;
    headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration);
  },
  FACEDIRI: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const yaw = STACK.pop() as number;
    STACK.pop(); // roll is never used in the real game
    const pitch = STACK.pop() as number;
    headController.disable(yaw, pitch, duration);
  },
  FACEDIRINIT: () => {},
  FACEDIRLIMIT: ({ headController, STACK }) => {
    const yawLimit = STACK.pop() as number;
    STACK.pop(); // roll limit — unused (v29 = 0 in sub_472B30)
    const pitchLimit = STACK.pop() as number;
    headController.setLimits(pitchLimit, yawLimit);
  },
  FACEDIROFF: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    headController.disable(0, 0, duration);
  },
  FACEDIRP: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;
    headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration);
  },
  FACEDIRSYNC: async ({ headController }) => {
    await headController.sync();
  },
  FADEBLACK: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(0);
  },
  FADEIN: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(1, 250);
  },
  FADENONE: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(1);
  },
  FADEOUT: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(0, 500);
  },
  FADESYNC: async () => {
    const { fadeSpring } = useGlobalStore.getState();
    while (fadeSpring.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  FCOLADD: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const endBlue = STACK.pop() as number;
    const endGreen = STACK.pop() as number;
    const endRed = STACK.pop() as number;
    const startBlue = STACK.pop() as number;
    const startGreen = STACK.pop() as number;
    const startRed = STACK.pop() as number;

    useGlobalStore.setState({
      colorOverlay: {
        startRed,
        startGreen,
        startBlue,
        endRed,
        endGreen,
        endBlue,
        duration,
        type: 'additive'
      },
      isTransitioningColorOverlay: true
    });
  },
  FCOLSUB: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const endBlue = STACK.pop() as number;
    const endGreen = STACK.pop() as number;
    const endRed = STACK.pop() as number;
    const startBlue = STACK.pop() as number;
    const startGreen = STACK.pop() as number;
    const startRed = STACK.pop() as number;

    useGlobalStore.setState({
      colorOverlay: {
        startRed,
        startGreen,
        startBlue,
        endRed,
        endGreen,
        endBlue,
        duration,
        type: 'subtractive'
      },
      isTransitioningColorOverlay: true
    });
  },

  // FMOVE: turn, no animation
  FMOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const lastThree = STACK.splice(-3);
    const target = new Vector3(...lastThree.map(numberToFloatingPoint) as [number, number, number]);

    await movementController.moveToPoint(target, {
      isAnimationEnabled: false,
      isFacingTarget: true,
      distanceToStopAnimationFromTarget
    });
  },
  FMOVEA: async ({ movementController, STACK, scene }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const actorId = STACK.pop() as number;

    await movementController.moveToObject(`entity--${actorId}`, scene, {
      isAnimationEnabled: false,
      isFacingTarget: true,
      distanceToStopAnimationFromTarget
    });
  },
  FMOVEP: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;

    await movementController.moveToObject(`party--${partyMemberId}`, scene, {
      isAnimationEnabled: false,
      isFacingTarget: true,
      distanceToStopAnimationFromTarget
    });
  },
  FOLLOWOFF: ({ script }) => {
    const { party, partyMembersFollowing } = useGlobalStore.getState();
    if (script.character < 0 || !party.includes(script.character)) {
      return;
    }
    useGlobalStore.setState({
      partyMembersFollowing: partyMembersFollowing.filter(id => id !== script.character),
    });
  },
  FOLLOWON: ({ script }) => {
    const { party, partyMembersFollowing } = useGlobalStore.getState();
    if (script.character < 0 || !party.includes(script.character)) {
      return;
    }
    if (partyMembersFollowing.includes(script.character)) {
      return;
    }
    useGlobalStore.setState({
      partyMembersFollowing: [...partyMembersFollowing, script.character],
    });
  },

  
  // SOUND

  FOOTSTEP: ({ currentOpcode, STACK }) => {
    const footstepSoundId = STACK.pop() as number; //footstep pair ID?
    console.log(currentOpcode.param, footstepSoundId)
   // movementController.setFootsteps('FOOTSTEPS', footstepSoundId)
  },
  FOOTSTEPCOPY: dummiedCommand,
  FOOTSTEPCUT: ({ movementController }) => {
    movementController.resetFootsteps();
  },
  FOOTSTEPOFF: ({ movementController }) => {
    movementController.disableFootsteps();
  },
  FOOTSTEPOFFALL: () => { },
  FOOTSTEPON: ({ movementController }) => {
    movementController.enableFootsteps();
  },


  // FAKED
  GAMEOVER: () => {
    console.error('GAME OVER WHAT DID YOU DO');
  },
  GETCARD: ({ STACK, TEMP_STACK }) => {
    STACK.pop() as number;
    // Card collection not implemented — report card not yet obtained.
    TEMP_STACK[0] = 0;
  },
  GETDRESS: unusedCommand,
  GETHP: unusedCommand,
  GETINFO: ({ scene, script, TEMP_STACK }) => {
    const entity = getScriptEntity(scene, script.groupId);
    if (!entity) {
      console.warn('Entity not found', script.groupId);
      return;
    }
    const position = entity.getWorldPosition(new Vector3());

    // We need to get this script entity's X/Y and stick it in to:
    TEMP_STACK[0] = floatingPointToNumber(position.x);
    TEMP_STACK[1] = floatingPointToNumber(position.y);
    TEMP_STACK[2] = floatingPointToNumber(position.z);
  },
  GETPARTY: ({ STACK, TEMP_STACK }) => {
    const index = STACK.pop() as number;
    TEMP_STACK[0] = useGlobalStore.getState().party[index];
  },
  GETTIMER: ({ currentState, TEMP_STACK }) => {
    TEMP_STACK[0] = currentState.countdownTime
  },
  GJMP: unusedCommand,
  HALT: () => {
    return -2
  },
  HASITEM: ({ STACK, TEMP_STACK }) => {
    STACK.pop() as number;
    // Inventory not implemented — always report the item as held.
    TEMP_STACK[0] = 1;
  },
  HIDE: ({ setState }) => {
    setState({ isVisible: false, isPushable: false, isTalkable: false })
  },
  HOLD: ({ STACK }) => {
    STACK.splice(-3);
  },
  HOWMANYCARD: ({ STACK, TEMP_STACK }) => {
    STACK.pop() as number;
    // Card collection not implemented — report zero copies of the card.
    TEMP_STACK[0] = 0;
  },
  IDLOCK: ({ currentOpcode }) => {
    const currentLockedTriangles = useGlobalStore.getState().lockedTriangles;
    useGlobalStore.setState({
      lockedTriangles: [...currentLockedTriangles, currentOpcode.param]
    })
  },
  IDUNLOCK: ({ currentOpcode }) => {
    const currentLockedTriangles = useGlobalStore.getState().lockedTriangles;
    useGlobalStore.setState({
      lockedTriangles: currentLockedTriangles.filter(id => id !== currentOpcode.param)
    })
  },
  
  // Initialises music system, not needed
  INITSOUND: () => { },
  INITTRACE: () => { },
  ISMEMBER: unusedCommand,
  ISPARTY: ({ STACK, TEMP_STACK }) => {
    const characterID = STACK.pop() as number;
    const indexInParty = useGlobalStore.getState().party.indexOf(characterID)
    TEMP_STACK[0] = indexInParty;
  },
  ISTOUCH: ({ scene, script, STACK, TEMP_STACK }) => {
    const actorId = STACK.pop() as number;
    const isTouch = isTouching(script.groupId, `entity--${actorId}`, scene)

    TEMP_STACK[0] = isTouch ? 1 : 0;
  },
  JMP: ({ currentOpcode, opcodes }) => {
    const targetLabelIndex = opcodes.findIndex(opcode => opcode.name === `LABEL${currentOpcode.param}`);
    return targetLabelIndex;
  },
  JOIN: () => {
    useGlobalStore.setState({
      partyMembersFollowing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
  },
  // NOTE: Jump logic differs from the original implementation
  // We precalculate the target label name and jump directly to it
  JPF: ({ currentOpcode, opcodes, STACK }) => {
    const condition = STACK.pop() as number;
    if (condition === 0) {
      return opcodes.findIndex(opcode => opcode.name === `LABEL${currentOpcode.param}`);
    }
  },

  // I think these are identical. Maybe in reality they use different curves. Jump is used only 3 times though.
  JUMP: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const target = vectorToFloatingPoint({x, y, z})

    movementController.jumpToPosition(target, duration);
  },
  JUMP3: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const target = vectorToFloatingPoint({x, y, z})

    movementController.jumpToPosition(target, duration);
  },
  // Flips Squall/Laguna teams
  JUNCTION: ({ STACK }) => {
    const isNowLaguna = (STACK.pop() as number) === 1;
    useGlobalStore.setState(state => ({
      ...state,
      sleepingParty: isNowLaguna ? [...state.party] : [],
      party: isNowLaguna ? [8, 9, 10] : [...state.sleepingParty],
    }))
  },
  // Used once in the balamb basement. I think it might clear a ladder key?
  KEY: ({ STACK }) => {
    STACK.pop() as number;
  },
  KEYON: ({ STACK, TEMP_STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS);
    TEMP_STACK[0] = isDown ? 1 : 0;
  },
  KEYON2: unusedCommand,
  KEYSCAN: ({ STACK, TEMP_STACK }) => {
    const key = STACK.pop() as keyof typeof KEY_FLAGS
    const isDown = wasKeyPressed(key);
    TEMP_STACK[0] = isDown ? 1 : 0;
  },
  KEYSCAN2: ({ STACK, TEMP_STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS);
    TEMP_STACK[0] = isDown ? 1 : 0;
  },
  // This changes the key of background music. It lives on in the test menu, never ingame.
  // We use MP3s so not implementable anyway
  KEYSIGHNCHANGE: ({ STACK }) => {
    STACK.pop() as number;
  },
  KILLBAR: ({ STACK }) => {
    STACK.pop() as number;
  },
  KILLTIMER: ({ currentState, setState }) => {
    window.clearTimeout(currentState.countdownTimer);
    setState({
      countdownTimer: undefined,
    })
    
  },
  LADDERANIME: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const startFrame = STACK.pop() as number;
    const endFrame = STACK.pop() as number;

    animationController.setLadderAnimation(animationId, startFrame, endFrame);
  },
  LADDERDOWN: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param);
    STACK.splice(-4);
  },
  LADDERDOWN2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3));
    const middle = vectorToFloatingPoint(STACK.splice(-3)); // middle, not used
    vectorToFloatingPoint(STACK.splice(-3));

    await handleLadder(animationController, movementController, middle, end, false);
  },
  LADDERUP: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param);
    STACK.splice(-4);
  },
  LADDERUP2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3));
    const middle = vectorToFloatingPoint(STACK.splice(-3)); // middle, not used
    vectorToFloatingPoint(STACK.splice(-3));

    await handleLadder(animationController, movementController, middle, end, true);
  },
  LASTIN: ({ STACK }) => {
    STACK.pop() as number;
  },
  LASTOUT: dummiedCommand,

  
  LBL: dummiedCommand,
  LINEOFF: ({ setState }) => {
    setState({ isLineOn: false })
  },
  LINEON: ({ setState }) => {
    setState({ isLineOn: true })
  },

  LOADSYNC: () => { },
  /*
  Prefixes:
  d – instant camera
  c – relative to camera viewport
  l – relative to level ('absolute')

  Suffix:
  none – affects camera/everything
  2 – affects a single layer
  3 – affects a single layer, sets both start and end values

  CSCROLL2 moves a single layer AND the camera while not adjusting other layers, allowing the scene to move with a layer
  */
  LOFFSET: ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    movementController.moveToOffset(x, y, z, duration);
  },
  LOFFSETS: async ({ movementController, STACK }) => {
    const duration = STACK.pop() as number;
    const endZ = STACK.pop() as number;
    const endY = STACK.pop() as number;
    const endX = STACK.pop() as number;
    const startZ = STACK.pop() as number;
    const startY = STACK.pop() as number;
    const startX = STACK.pop() as number;

    await movementController.moveToOffset(startX, startY, startZ, 0)
    movementController.moveToOffset(endX, endY, endZ, duration);
  },
  LSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, duration, 'level');
  },
  LSCROLL2: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, x, y, duration, 'level');
  },
  LSCROLL3: async ({ STACK }) => {
    const duration = STACK.pop() as number;
    const endY = STACK.pop() as number;
    const endX = STACK.pop() as number;
    const startY = STACK.pop() as number;
    const startX = STACK.pop() as number;
    
    // Pop layer ID from stack
    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, -startX, -startY, 0, 'level');
    setLayerScroll(layerID, -endX, -endY, duration, 'level');
  },
  LSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, duration);
  },
  LSCROLLA2: unusedCommand,
  LSCROLLP: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;

    const mesh = getPartyMemberModelComponent(scene, partyMemberId);
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' LSCROLLP');
      return;
    }
    setCameraAndLayerFocus(mesh, duration);
  },
  LSCROLLP2: unusedCommand,
  // Pause the script while this character does a slow, walking-style turn to
  // look at another character on screen. Gentler and more natural-looking
  // than CTURN.
  LTURN: async ({ rotationController, scene, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const targetId = STACK.pop() as number;
    await rotationController.turnToFaceEntity(`entity--${targetId}`, scene, 'gentle');
  },
  // Pause the script while this character does a slow, walking-style turn to
  // a specific compass direction. The L/R suffix in the original probably meant
  // "favour turning left/right" but both branches collapse to the shortest
  // path, so we don't pass a direction hint.
  LTURNL: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'gentle');
  },
  LTURNR: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'gentle');
  },
  MACCEL: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
  },
  MAPFADEOFF: () => {
    useGlobalStore.setState({ isMapFadeEnabled: false });
  },
  MAPFADEON: () => {
    useGlobalStore.setState({ isMapFadeEnabled: true });
  },
  MAPJUMP: ({ STACK }) => {
    const mapJumpDetailsInMemory = STACK.splice(-4);

    useGlobalStore.setState({
      pendingFieldId: MAP_NAMES[mapJumpDetailsInMemory[0]],
      pendingCharacterPosition: vectorToFloatingPoint(mapJumpDetailsInMemory.slice(1, 4) as unknown as [number, number, number]),
    });
  },
  MAPJUMP3: ({ STACK }) => {
    const mapJumpDetailsInMemory = STACK.splice(-5);

    useGlobalStore.setState({
      pendingFieldId: MAP_NAMES[mapJumpDetailsInMemory[0]],
      initialAngle: mapJumpDetailsInMemory[4],
      pendingCharacterPosition: vectorToFloatingPoint(mapJumpDetailsInMemory.slice(1, 4) as unknown as [number, number, number]),
    });
  },
  MAPJUMPO: ({ STACK }) => {
    STACK.pop() as number; // const walkmeshTriangleId = STACK.pop() as number;
    const fieldId = STACK.pop() as number;

    useGlobalStore.setState({
      pendingFieldId: MAP_NAMES[fieldId],
    });
  },
  MAPJUMPOFF: () => {
    useGlobalStore.setState({ isMapJumpEnabled: false });
  },
  MAPJUMPON: () => {
    useGlobalStore.setState({ isMapJumpEnabled: true });
  },
  MENUDISABLE: dummiedCommand,
  MENUENABLE: dummiedCommand,
  MENUNAME: ({ STACK }) => {
    STACK.pop() as number;
  },
  MENUNORMAL: dummiedCommand,
  MENUPHS: dummiedCommand,
  MENUSAVE: dummiedCommand,


  MENUSHOP: async ({ STACK }) => {
    // Likely shop ID
    STACK.pop() as number;
    await openMessage('shop', ['Shop not implemented.'], {
      x: 20,
      y: 20,
      width: undefined,
      height: undefined,
      channel: 0,
    }, true, undefined)
  },
  MENUTIPS: ({ STACK }) => {
    STACK.pop() as number;
  },

  MENUTUTO: () => { },
  MES: async ({ currentState, STACK }) => {
    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    const { x, y, width, height } = currentState.winSize[channel];

    displayMessage(id, x, y, channel, width, height, false);
  },
  MESFORCUS: unusedCommand,
  MESMODE: ({ STACK }) => {
    const color = STACK.pop() as number;
    const mode = STACK.pop() as number;
    const channel = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      messageStyles: {
        ...state.messageStyles,
        [channel]: {
          color,
          mode,
        },
      },
    }));
  },
  MESSYNC: async ({ STACK }) => {
    const channel = STACK.pop() as number;

    while (useGlobalStore.getState().currentMessages.some(message => message.placement.channel === channel)) {
      const messagesOnChannel = useGlobalStore.getState().currentMessages.filter(message => message.placement.channel === channel);
      if (!messagesOnChannel[0].isCloseable) {
        enableMessageToClose(messagesOnChannel[0].id);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  MESVAR: ({ STACK }) => {
    const value = STACK.pop() as number;
    const id = STACK.pop() as number;
    MESSAGE_VARS[id] = value.toString();
  },
  MESW: ({ STACK }) => {
    STACK.splice(-2);
  },

  // ?
  MLIMIT: ({ STACK }) => {
    // unknown
    STACK.pop() as number;
  },


  MOVE: async ({ movementController, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const lastThree = STACK.splice(-3);
    const target = new Vector3(...lastThree.map(numberToFloatingPoint) as [number, number, number]);

    await movementController.moveToPoint(target, {
      distanceToStopAnimationFromTarget,
    });
  },

  // MOVEA: move to actor
  MOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const actorId = STACK.pop() as number;

    await movementController.moveToObject(`entity--${actorId}`, scene, {
      distanceToStopAnimationFromTarget,
    });
  },
  MOVECANCEL: ({ scene, STACK }) => {
    const actorId = STACK.pop() as number;
    const targetEntity = getScriptEntity(scene, actorId);
    if (!targetEntity) {
      console.warn(`MOVECANCEL: entity ${actorId} not found`);
      return;
    }
    const targetMovementController = targetEntity.userData.movementController as ReturnType<typeof createMovementController> | undefined;
    if (targetMovementController) {
      targetMovementController.stop();
    }
  },
  MOVEFLUSH: ({ movementController }) => {
    movementController.stop();
  },

  MOVESYNC: async ({ movementController }) => {
    while (movementController.getState().position.waypoints) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  // Memory 80 is used to track frames. This is used to fake a movie
  MOVIE: () => {
    MEMORY['80'] = 0;
    const interval = setInterval(() => {
      MEMORY['80'] += 100;
      if (MEMORY['80'] > 3000) {
        clearInterval(interval);
      }
    }, MS_PER_FRAME);
  },

  // Never used ingame (excluding test and bgmast_6 (a weird unused level))
  MOVIECUT: unusedCommand,


  /// MOVIES
  MOVIEREADY: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  MOVIESYNC: dummiedCommand, // used to sync with a movie, we do not show movies so this is dummied and returns done immediately
  MSPEED: ({ movementController, STACK }) => {
    const movementSpeed = STACK.pop() as number;
    movementController.setMovementSpeed(movementSpeed);
  },
  MUSICCHANGE: () => {
    musicController.playMusic();
  },
  MUSICLOAD: ({ STACK }) => {
    const id = STACK.pop() as keyof typeof MUSIC_IDS;
    musicController.preloadMusic(MUSIC_IDS[id]);
  },
  // This is used once. I think it restarts the track?
  MUSICREPLAY: () => {
  },
  MUSICSKIP: ({ STACK }) => {
    // const unknown = 
    STACK.pop() as number;
  },
  // This is an assumption
  MUSICSTATUS: ({ TEMP_STACK }) => {
    const isPlaying = useGlobalStore.getState().backgroundMusic?.playing() ? 1 : 0
    TEMP_STACK[0] = isPlaying;
  },
  MUSICSTOP: ({  STACK }) => {
    const channel = STACK.pop() as 1 | 0;
    musicController.pauseChannel(channel);
  },
  MUSICVOL: ({  STACK }) => {
    const volume = STACK.pop() as number;
    const channel = STACK.pop() as number;
    musicController.setVolume(channel, volume);
  },
  MUSICVOLFADE: ({ STACK }) => {
    STACK.pop() as number; // const startVolume =  //maybe?
    STACK.pop() as number; // const frames =  //maybe?
    STACK.pop() as number; // const endVolume = 
    STACK.pop() as number; // ???
  },
  MUSICVOLSYNC: () => { },
  MUSICVOLTRANS: ({  STACK }) => {
    const volume = STACK.pop() as number;
    const duration = STACK.pop() as number;
    const channel = STACK.pop() as number;
    
    musicController.transitionVolume(channel, volume, duration);
  },
  NOP: unusedCommand,
  OFFSETSYNC: async ({ movementController}) => {
    while (movementController.getState().offset.goal) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  OPENEYES: unusedCommand,
  PARTICLEOFF: ({ STACK }) => {
    STACK.pop() as number;
  },
  PARTICLEON: ({ STACK }) => {
    STACK.pop() as number;
  },
  PARTICLESET: ({ STACK }) => {
    STACK.pop() as number;
  },
  PCOPYINFO: unusedCommand,
  // Pause the script while this character does a quick, combat-style turn to
  // look at one of the active party members.
  PCTURN: async ({ rotationController, scene, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const partyMemberId = STACK.pop() as number;
    await rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, 'fast');
  },
  // Snap this character to face one of the active party members instantly.
  PDIRA: ({ rotationController, scene, STACK }) => {
    const partyMemberId = STACK.pop() as number;
    rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, 0);
  },
  PGETINFO: ({ scene, script, STACK, TEMP_STACK }) => {
    const partyMemberId = STACK.pop() as number;
    const mesh = getPartyMemberModelComponent(scene, partyMemberId);

    if (!mesh) {
      console.warn(script, 'No mesh found for actor ID', partyMemberId);
      return;
    }

    const position = mesh.getWorldPosition(new Vector3());
    const { x, y, z } = position;

    TEMP_STACK[0] = floatingPointToNumber(x);
    TEMP_STACK[1] = floatingPointToNumber(y);
    TEMP_STACK[2] = floatingPointToNumber(z);
  },
  // Enables changing party
  PHSENABLE: ({ STACK }) => {
    STACK.pop() as number;
  },
  PHSPOWER: ({ STACK }) => {
    STACK.pop() as number;
  },
  PJUMPA: ({ movementController, scene, STACK }) => {
    //STACK.pop() as number;
    const actorId = STACK.pop() as number;
    const player = getPartyMemberModelComponent(scene, actorId)
    if (!player) {
      console.warn('No player found for party member ID', actorId);
      return;
    }

    const targetPoint = player.getWorldPosition(new Vector3());

    movementController.jumpToPosition(targetPoint, 32);
  },
  // Pause the script while this character does a slow, walking-style turn to
  // look at one of the active party members.
  PLTURN: async ({ rotationController, scene, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const partyMemberId = STACK.pop() as number;
    await rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, 'gentle');
  },

  // PMOVEA: move to party member
  PMOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;

    await movementController.moveToObject(`party--${partyMemberId}`, scene, {
      distanceToStopAnimationFromTarget
    })
  },
  PMOVECANCEL: () => {},
  POLYCOLOR: ({ setState, STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    setState({
      meshTintColor: [red, green, blue],
    });
  },
  POLYCOLORALL: ({ STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    useGlobalStore.setState({
      globalMeshTint: [red, green, blue],
    });
  },
  POPANIME: () => { },
  POPI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    TEMP_STACK[currentOpcode.param] = STACK.pop() as number;
  },
  POPM_B: ({ currentOpcode, STACK }) => {
    const value = STACK.pop() as number;
    MEMORY[currentOpcode.param] = value;
  },
  POPM_L: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number;
  },
  POPM_W: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number;
  },
  PREMAPJUMP: ({ STACK }) => {
    STACK.splice(-4);
  },
  PREMAPJUMP2: ({ STACK }) => {
    STACK.pop() as number;
  },
  PREQ: ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    console.log('PREQ', partyMemberIndex, label, priority);
    remoteExecutePartyMember(scene, partyMemberIndex, label, priority)
  },
  PREQEW: async ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    console.log('start preqew', partyMemberIndex, label, priority)
    await remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true)
    console.log('end preqew', partyMemberIndex, label, priority)
  },
  PREQSW: async ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    await remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true, 'start')
  },
  PSHAC: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param);
  },
  PSHI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    STACK.push(TEMP_STACK[currentOpcode.param] ?? 0);
  },
  PSHM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHN_L: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param);
  },
  PSHSM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHSM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHSM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PUSHANIME: () => { },
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
    const radius = STACK.pop() as number;
    setState({
      pushRadius: radius,
    })
  },
  RAMESW: async ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    displayMessage(id, x, y, channel);
  },
  RANIME: ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param;

    animationController.playAnimation(animationId)
  },
  RANIMEKEEP: ({ animationController, currentOpcode }) => {
    const animationId = currentOpcode.param;

    animationController.playAnimation(animationId, {
      shouldHoldLastFrame: true,
    });
  },
  RANIMELOOP: ({ animationController, currentOpcode, }) => {
    const animationId = currentOpcode.param;

    animationController.playAnimation(animationId, {
      isLooping: true,
    })
  },
  RBGANIME: ({ script, STACK }) => {
    const end = STACK.pop() as number;
    const start = STACK.pop() as number

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId];
    const lerpValue = new LerpValue(start, SPEEDS.BG);
    const duration = lerpValue.calculateDuration(speed);
    lerpValue.start(end, duration, 0);

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true
      }
    })
  },
  RBGANIMELOOP: ({ script, STACK }) => {
    const end = STACK.pop() as number;
    const start = STACK.pop() as number

    const speed = useGlobalStore.getState().backgroundLayerSpeeds[script.backgroundParamId];
    const lerpValue = new LerpValue(start, SPEEDS.BG);
    const duration = lerpValue.calculateDuration(speed);
    lerpValue.start(end, duration, 0, true);

    useGlobalStore.setState({
      backgroundAnimations: {
        ...useGlobalStore.getState().backgroundAnimations,
        [script.backgroundParamId]: lerpValue
      },
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [script.backgroundParamId]: true
      }
    })
  },
  RBGSHADELOOP: ({ script,STACK }) => {
    const holdOut = STACK.pop() as number;
    const holdIn = STACK.pop() as number;
    const endBlue = STACK.pop() as number;
    const endGreen = STACK.pop() as number;
    const endRed = STACK.pop() as number;
    const startBlue = STACK.pop() as number;
    const startGreen = STACK.pop() as number;
    const startRed = STACK.pop() as number;
    const durationOut = STACK.pop() as number;
    const durationIn = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      layerTints: {
        ...state.layerTints,
        [script.backgroundParamId]: {
          durationIn,
          durationOut,
          startRed,
          startGreen,
          startBlue,
          endRed,
          endGreen,
          endBlue,
          holdIn,
          holdOut,
          isLooping: true
        }
      }
    }))
  },
  RCANIME: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const firstFrame = STACK.pop() as number;
    const lastFrame = STACK.pop() as number;

    animationController.playAnimation(animationId, {
      startFrame: firstFrame,
      endFrame: lastFrame,
    })
  },
  RCANIMEKEEP: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const firstFrame = STACK.pop() as number;
    const lastFrame = STACK.pop() as number;

    animationController.playAnimation(animationId, {
      startFrame: firstFrame,
      endFrame: lastFrame,
      shouldHoldLastFrame: true,
    })
  },
  RCANIMELOOP: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const startFrame = STACK.pop() as number;
    const endFrame = STACK.pop() as number;

    animationController.playAnimation(animationId, {
      startFrame,
      endFrame,
      isLooping: true,
    })
  },
  RCMOVE: async ({ STACK, movementController }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const lastThree = STACK.splice(-3);
    const target = new Vector3(...lastThree.map(numberToFloatingPoint) as [number, number, number]);

    await movementController.moveToPoint(target, {
      isAnimationEnabled: false,
      isFacingTarget: true,
      isAllowedToLeaveWalkmesh: true,
      distanceToStopAnimationFromTarget
    });
  },
  REFRESHPARTY: dummiedCommand, // used to ensure party changes are reflected everywhere, afaik
  // All scripts have a unique label, not sure why other IDs are required in game...
  REQ: ({ STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();
    remoteExecute(label, priority)
  },
  REQEW: async ({ script, STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();

    console.log('REQEW', script.name, label, priority)
    await remoteExecute(label, priority, true)
  },
  REQSW: async ({ STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();
    await remoteExecute(label, priority, true, 'start')
  },
  // Removes GFs from character. Unsure if stashes details in memory for recall
  RESETGF: ({ STACK }) => {
    STACK.pop() as number;
  },

  // Do not touch stack
  REST: dummiedCommand, // heal party and GFs
  RET: () => {
    return -1
  },
  RFACEDIR: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    await headController.turnToFaceWorldPosition(vectorToFloatingPoint({x, y, z}), duration);
  },
  RFACEDIRA: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const targetActorId = STACK.pop() as number;
    await headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration);
  },
  RFACEDIRI: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const yaw = STACK.pop() as number;
    STACK.pop(); // roll is never used by the real game
    const pitch = STACK.pop() as number;
    headController.disable(yaw, pitch, duration);
  },
  RFACEDIROFF: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    headController.disable(0, 0, duration);
  },
  RFACEDIRP: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;
    await headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration);
  },
  RFMOVE: async (args) => {
    OPCODE_HANDLERS?.FMOVE?.(args);
  },

  // R SET: do not await
  RMOVE: (args) => {
    OPCODE_HANDLERS?.MOVE?.(args);
  },
  RMOVEA: async (args) => {
    OPCODE_HANDLERS?.MOVEA?.(args);
  },
  RND: ({ TEMP_STACK }) => {
    TEMP_STACK[0] = Math.round(Math.random() * 255);
  },
  RPMOVEA: async (args) => {
    OPCODE_HANDLERS?.PMOVEA?.(args);
  },
  RUNDISABLE: () => {
    useGlobalStore.setState({ isRunEnabled: false });
  },
  RUNENABLE: () => {
    useGlobalStore.setState({ isRunEnabled: true });
  },
  SARALYDISPOFF: dummiedCommand,
  SARALYDISPON: dummiedCommand,
  SARALYOFF: dummiedCommand,
  SARALYON: dummiedCommand,
  SAVEENABLE: ({ STACK }) => {
    // const isEnabled =
    STACK.pop() as number;
  },

  SCROLLMODE2: ({ STACK }) => {
    const lastFive = STACK.splice(-5);
    const layerIndex = lastFive[0]; // layer id
    const xOffset = lastFive[1]; // I reckon offset
    const yOffset = lastFive[2]; // I reckon offset
    const xScrollSpeed = lastFive[3]; // a scroll ratio in a direction
    const yScrollSpeed = lastFive[4]; // a scroll ratio in a direction

    const controlledScroll = useGlobalStore.getState().layerScrollAdjustments[layerIndex] ?? {
      xOffset: 0,
      yOffset: 0,
      xScrollSpeed: 0,
      yScrollSpeed: 0,
    };

    controlledScroll.xOffset = xOffset;
    controlledScroll.yOffset = yOffset;
    controlledScroll.xScrollSpeed = xScrollSpeed;
    controlledScroll.yScrollSpeed = yScrollSpeed;

    useGlobalStore.setState({
      layerScrollAdjustments: {
        ...useGlobalStore.getState().layerScrollAdjustments,
        [layerIndex]: controlledScroll
      }
    })
  },
  SCROLLRATIO2: ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    const layer = STACK.pop() as number;

    useGlobalStore.setState({
      backgroundScrollRatios: {
        ...useGlobalStore.getState().backgroundScrollRatios,
        [layer]: {
          x,
          y,
        }
      }
    })
  },
  SCROLLSYNC: async () => {
    while (
      useGlobalStore.getState().cameraScrollOffset.isInProgress ||
      Object.values(useGlobalStore.getState().layerScrollOffsets).some(transition => transition.isInProgress) ||
      useGlobalStore.getState().cameraFocusSpring?.isAnimating
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  SCROLLSYNC2: async ({ STACK }) => {
    const layerID = STACK.pop() as number;

    while (useGlobalStore.getState().layerScrollOffsets[layerID] && useGlobalStore.getState().layerScrollOffsets[layerID].isInProgress) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  SEALEDOFF: ({ STACK }) => {
    STACK.pop() as number;
  },
  SEPOS: ({ sfxController, STACK }) => {
    const pan = STACK.pop() as number;
    const channel = STACK.pop() as number;

    sfxController.setPan(channel, pan);
  },
  SEPOSTRANS: ({ sfxController, STACK }) => {
    const pan = STACK.pop() as number;
    const duration = STACK.pop() as number;
    const channel = STACK.pop() as number;

    sfxController.setPan(channel, pan, duration);
  },
  SESTOP: ({ sfxController, STACK }) => {
    const channel = STACK.pop() as number;
    sfxController.stop(channel);
  },
  SET: ({ currentOpcode, movementController, STACK }) => {
    const lastTwo = STACK.splice(-2);
    const knownPosition = lastTwo.map(numberToFloatingPoint) as [number, number];
    const vector = new Vector3(knownPosition[0], knownPosition[1], 0);
    
    const walkmeshController = useGlobalStore.getState().walkmeshController;
    if (!walkmeshController) {
      console.warn('No walkmesh controller');
      return;
    }

    const position = walkmeshController.getPositionOnWalkmesh(vector);
    if (!position) {
      console.warn('Position not found on walkmesh', vector);
      return;
    }

    movementController.setPosition(position, currentOpcode.param);
  },
  SET3: async ({ currentOpcode, movementController, STACK }) => {
    const lastThree = STACK.splice(-3);
    const position = new Vector3(...lastThree.map(numberToFloatingPoint) as [number, number, number]);
    movementController.setPosition(position, currentOpcode.param);
  },
  SETBAR: ({ STACK }) => {
    STACK.splice(-2);
  },
  SETBATTLEMUSIC: ({ STACK }) => {
    const musicId = STACK.pop() as number;
    musicController.setBattleMusic(musicId);
  },
  SETCAMERA: ({ STACK }) => {
    useGlobalStore.setState({
      activeCameraId: STACK.pop() as number
    })
  },
  SETCARD: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  // Camera movement during movie overlays
  SETDCAMERA: ({ STACK }) => {
    STACK.pop() as number;
  },
  SETDRAWPOINT: ({ STACK, setState }) => {
    const isDrawPoint = STACK.pop() as number;
    setState({ isDrawPoint: Boolean(isDrawPoint) });
  },
  SETDRESS: ({ STACK }) => {
    const outfitId = STACK.pop() as number;
    const playerId = STACK.pop() as number;
    console.log('Set dress:', { outfitId, playerId });
    MEMORY[720 + playerId] = outfitId;
  },
  // We don't use actor codes for REQ etc, this seems to work fine.
  SETGETA: ({ STACK }) => {
    // const actorId = 
    STACK.pop() as number;
  },
  SETHP: ({ STACK }) => {
    // I assume actorId + HP
    STACK.splice(-2);
  },
  // MODIFIED JUMP LOGIC ENDS
  SETLINE: ({ setState, STACK }) => {
    const linePointsInMemory = STACK.splice(-6);
    setState({
      linePoints: [
        vectorToFloatingPoint(linePointsInMemory.slice(0, 3)),
        vectorToFloatingPoint(linePointsInMemory.slice(3)),
      ]
    })
  },
  SETMESSPEED: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  SETMODEL: ({ setState, currentOpcode }) => {
    const modelId = currentOpcode.param;

    setState({
      modelId
    })
  },
  SETODIN: dummiedCommand,
  SETPARTY: ({ STACK }) => {
    const character3ID = STACK.pop() as number;
    const character2ID = STACK.pop() as number;
    const character1ID = STACK.pop() as number;

    const uniqueParty = Array.from(new Set([character1ID, character2ID, character3ID])).filter(id => id !== 255);

    useGlobalStore.setState({
      party: uniqueParty
    })
  },
  SETPARTY2: unusedCommand,
  SETPC: ({ setState, STACK }) => {
    const partyMemberId = STACK.pop() as number;
    setState({
      partyMemberId,
    })
  },
  SETPLACE: ({ STACK }) => {
    const placeName = STACK.pop() as number;
    useGlobalStore.setState({ currentLocationPlaceName: placeName });
  },
  SETROOTTRANS: ({ STACK }) => {
    // unknown
    STACK.pop() as number;
  },
  SETTIMER: ({ currentState,setState, STACK }) => {
    const time = STACK.pop() as number;

    const timer = window.setTimeout(() => {
      setState(state => ({
        countdownTime: state.countdownTime - 1
      }))
      console.log(currentState.countdownTime);
      if (currentState.countdownTime <= 0) {
        window.clearTimeout(currentState.countdownTimer);
        setState({
          countdownTimer: undefined
        })
      }
    }, 1000);

    setState({
      countdownTime: time,
      countdownTimer: timer,
    })
  },
  SETVIBRATE: ({ STACK }) => {
    STACK.splice(-2);
  },
  SETWITCH: ({ STACK }) => {
    STACK.pop() as number;
  },
  SEVOL: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const channel = STACK.pop() as number;

    sfxController.setVolume(channel, volume);
  },
  SEVOLTRANS: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const duration = STACK.pop() as number;
    const channel = STACK.pop() as number;

    sfxController.setVolume(channel, volume, duration);
  },
  SHADEFORM: ({ STACK }) => {
    STACK.splice(-8)
  },
  SHADELEVEL: ({ STACK }) => {
    // const shadeLevel = 
    STACK.pop() as number;
  },
  SHADESET: ({ STACK }) => {
    STACK.pop() as number;
  },
  SHADETIMER: unusedCommand,
  SHAKE: ({ STACK }) => {
    //const lastFour =
    STACK.splice(-4);
  },
  SHAKEOFF: () => { },
  SHOW: ({ setState }) => {
    setState({ isVisible: true, isPushable: true, isTalkable: true })
  },
  SPLIT: async ({ scene, STACK }) => {
    useGlobalStore.setState({
      partyMembersFollowing: []
    });

    const member3Position = vectorToFloatingPoint(STACK.splice(-3));
    const member2Position = vectorToFloatingPoint(STACK.splice(-3));
    const member1Position = vectorToFloatingPoint(STACK.splice(-3));

    const controllerPromises: Promise<void>[] = [];
    const member1 = getPartyMemberModelComponent(scene, 0)
    const member1MovementController = member1!.userData.movementController as ReturnType<typeof createMovementController>
    member1MovementController.setMovementSpeed(2560);
    controllerPromises.push(member1MovementController.moveToPoint(member1Position));

    const member2 = getPartyMemberModelComponent(scene, 1)
    if (member2) {
      const member2MovementController = member2.userData.movementController as ReturnType<typeof createMovementController>
      member2MovementController.setMovementSpeed(2560);
      controllerPromises.push(member2MovementController.moveToPoint(member2Position));
    }

    const member3 = getPartyMemberModelComponent(scene, 2)
    if (member3) {
      const member3MovementController = member3.userData.movementController as ReturnType<typeof createMovementController>
      member3MovementController.setMovementSpeed(2560);
      controllerPromises.push(member3MovementController.moveToPoint(member3Position));
    }

    await Promise.all(controllerPromises);
  },
  // These two are used to synchronise the Eyes on Me sequence
  // SPU here is the PS1 Sound Processing Unit
  SPUREADY: ({ STACK }) => {
    const startTime = STACK.pop() as number; // always 0
    useGlobalStore.setState({ spuValue: startTime });
    const tick = () => {
      useGlobalStore.setState(state => ({ ...state, spuValue: state.spuValue + 1 }));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  SPUSYNC: async ({ STACK }) => {
    const frames = STACK.pop() as number;
    while (useGlobalStore.getState().spuValue < frames) {
      console.log('Waiting for SPU sync', useGlobalStore.getState().spuValue, frames);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  STOPVIBRATE: unusedCommand,
  SUBMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      availableCharacters: useGlobalStore.getState().availableCharacters.filter(id => id !== characterID),
      party: useGlobalStore.getState().party.filter(id => id !== characterID),
    });
  },
  SUBPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      party: useGlobalStore.getState().party.filter(id => id !== characterID)
    });
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
    const radius = STACK.pop() as number;
    setState({
      talkRadius: radius,
    })
  },

  TCOLADD: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;
    
    useGlobalStore.setState(state => ({
      ...state,
      colorOverlay: {
        ...state.colorOverlay,
        duration,
        endRed: red,
        endGreen: green,
        endBlue: blue,
        type: 'additive'
      },
      isTransitioningColorOverlay: true
    }));
  },
  TCOLSUB: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    useGlobalStore.setState(state => ({
      ...state,
      colorOverlay: {
        ...state.colorOverlay,
        duration,
        endRed: red,
        endGreen: green,
        endBlue: blue,
        type: 'subtractive'
      },
      isTransitioningColorOverlay: true
    }));
  },
  THROUGHOFF: ({ setState }) => {
    setState({ isSolid: true })
  },
  THROUGHON: ({ setState }) => {
    setState({ isSolid: false })
  },
  TUTO: ({ STACK }) => {
    STACK.pop() as number;
  },
  UCOFF: () => {
    useGlobalStore.setState({ isUserControllable: false });
  },
  UCON: () => {
    useGlobalStore.setState({ isUserControllable: true });
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN1: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN10: dummiedCommand,
  // Start turning this character to look at a party member without pausing
  // the script — the turn keeps playing in the background while later
  // opcodes run. Use UNKNOWN12 (PIVOT_SYNC) later to wait for it to finish.
  UNKNOWN11: ({ rotationController, scene, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const partyMemberId = STACK.pop() as number;
    rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, 'fast');
  }, // "PIVOT"
  // Pause the script here until the background pivot turn started by
  // UNKNOWN11 has finished playing.
  UNKNOWN12: async ({ rotationController }) => {
    while (rotationController.getState().angle.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, // "PIVOT_SYNC"
  UNKNOWN13: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN14: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN15: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Sets draw point ID
  UNKNOWN16: ({ STACK }) => {
    STACK.pop() as number;
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN17: ({ STACK }) => {
    STACK.pop() as number;
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN18: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN2: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN3: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN4: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Pause the script while this character does a slow, walking-style turn to
  // a specific compass direction, forced to spin clockwise even when the
  // shorter route would be counter-clockwise (useful for dramatic spins).
  UNKNOWN6: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'gentle', 'clockwise');
  },
  // Pause the script while this character does a slow, walking-style turn to
  // a specific compass direction, forced to spin counter-clockwise.
  UNKNOWN7: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'gentle', 'counterclockwise');
  },
  // Pause the script while this character does a quick, combat-style turn to
  // a specific compass direction, forced to spin clockwise.
  UNKNOWN8: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'fast', 'clockwise');
  },
  // Pause the script while this character does a quick, combat-style turn to
  // a specific compass direction, forced to spin counter-clockwise.
  UNKNOWN9: async ({ rotationController, STACK }) => {
    STACK.pop() as number; // animation byte — stack-balance only
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, 'fast', 'counterclockwise');
  },
  UNUSE: ({ setState }) => {
    setState({ isUnused: true })
  },
  USE: ({ setState }) => {
    setState({ isUnused: false })
  },

  WAIT: async ({ STACK }) => {
    const psxGameFrames = STACK.pop() as number;
    await wait(framesToMs(psxGameFrames));
  },
  WHERECARD: ({ STACK, TEMP_STACK }) => {
    STACK.pop() as number;
    // Card location lookup not implemented — return 0 placeholder.
    TEMP_STACK[0] = 0;
  },
  WHOAMI: ({ STACK, TEMP_STACK }) => {
    STACK.pop() as number;
    // Character data lookup not implemented — return 0 placeholder.
    TEMP_STACK[0] = 0;
  },
  WINCLOSE: ({ STACK }) => {
    const channel = STACK.pop() as number; // const channel

    const currentMessages = useGlobalStore.getState().currentMessages;
    
    const matchingMessages = currentMessages.filter(message => message.placement.channel === channel);
    const lastOpenedMessage = matchingMessages[0]
    if (!lastOpenedMessage) {
      console.warn('No message to close');
      return;
    }
    closeMessage(lastOpenedMessage.id, undefined);
  },
  WINSIZE: ({ currentState, STACK }) => {
    const height = STACK.pop() as number;
    const width = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    const channel = STACK.pop() as number;

    currentState.winSize[channel] = {
      x,
      y,
      width,
      height,
    }
  },
  WORLDMAPJUMP: ({ STACK }) => {
    const val1 = STACK.pop() as number;
    const val2 = STACK.pop() as number;
    const id = STACK.pop() as number;
    const paddedId = id.toString().padStart(2, '0');
    console.log('WORLDMAPJUMP', { val1, val2, id }, paddedId);
    useGlobalStore.setState({
      pendingFieldId: `wm${paddedId}` as typeof MAP_NAMES[number],
    });
  },

}
