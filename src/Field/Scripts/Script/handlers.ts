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


const dummiedCommand = () => { }
const unusedCommand = () => { }

export const musicController = MusicController();

type HandlerArgs = {
  animationController: ReturnType<typeof createAnimationController>,
  currentOpcode: OpcodeObj,
  currentOpcodeIndex: number,
  currentState: Readonly<ScriptState>,
  headController: ReturnType<typeof createRotationController>,
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
  RET: () => {
    return -1
  },
  HALT: () => {
    return -2
  },
  PSHI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    STACK.push(TEMP_STACK[currentOpcode.param] ?? 0);
  },
  POPI_L: ({ currentOpcode, STACK, TEMP_STACK }) => {
    TEMP_STACK[currentOpcode.param] = STACK.pop() as number;
  },
  PSHN_L: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param);
  },
  PSHM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHSM_B: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHSM_W: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  PSHSM_L: ({ currentOpcode, STACK }) => {
    STACK.push(MEMORY[currentOpcode.param] ?? 0);
  },
  POPM_L: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number;
  },
  POPM_B: ({ currentOpcode, STACK }) => {
    const value = STACK.pop() as number;
    MEMORY[currentOpcode.param] = value;
  },
  POPM_W: ({ currentOpcode, STACK }) => {
    MEMORY[currentOpcode.param] = STACK.pop() as number;
  },
  CLEAR: () => {
    MEMORY = {};
  },
  PSHAC: ({ currentOpcode, STACK }) => {
    STACK.push(currentOpcode.param);
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
    } else {
      console.warn(`CAL with param ${currentOpcode.param} not implemented.`);
    }
  },
  // NOTE: Jump logic differs from the original implementation
  // We precalculate the target label name and jump directly to it
  JPF: ({ currentOpcode, opcodes, STACK }) => {
    const condition = STACK.pop() as number;
    if (condition === 0) {
      return opcodes.findIndex(opcode => opcode.name === `LABEL${currentOpcode.param}`);
    }
  },
  JMP: ({ currentOpcode, opcodes }) => {
    const targetLabelIndex = opcodes.findIndex(opcode => opcode.name === `LABEL${currentOpcode.param}`);
    return targetLabelIndex;
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
  UCON: () => {
    useGlobalStore.setState({ isUserControllable: true });
  },
  UCOFF: () => {
    useGlobalStore.setState({ isUserControllable: false });
  },
  LINEON: ({ setState }) => {
    setState({ isLineOn: true })
  },
  LINEOFF: ({ setState }) => {
    setState({ isLineOn: false })
  },
  PREMAPJUMP: ({ STACK }) => {
    STACK.splice(-4);
  },
  MAPJUMPO: ({ STACK }) => {
    STACK.pop() as number; // const walkmeshTriangleId = STACK.pop() as number;
    const fieldId = STACK.pop() as number;

    useGlobalStore.setState({
      pendingFieldId: MAP_NAMES[fieldId],
    });
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
  DISCJUMP: (args) => {
    OPCODE_HANDLERS?.['MAPJUMP3']?.(args);
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
  SETPLACE: ({ STACK }) => {
    const placeName = STACK.pop() as number;
    useGlobalStore.setState({ currentLocationPlaceName: placeName });
  },
  KEYON: async ({ currentOpcodeIndex, STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS);
    if (isDown) {
      return currentOpcodeIndex + 2;
    }
  },
  KEYSCAN: ({ STACK, TEMP_STACK }) => {
    const key = STACK.pop() as keyof typeof KEY_FLAGS
    const isDown = wasKeyPressed(key);
    TEMP_STACK[0] = isDown ? 1 : 0;
  },
  KEYSCAN2: ({ STACK, TEMP_STACK }) => {
    const isDown = isKeyDown(STACK.pop() as keyof typeof KEY_FLAGS);
    TEMP_STACK[0] = isDown ? 1 : 0;
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
    // Maybe?
    const unknown = STACK.pop() as number;
  
    useGlobalStore.setState({
      backgroundLayerVisibility: {
        ...useGlobalStore.getState().backgroundLayerVisibility,
        [unknown + 1]: false
      }
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
  BGSHADESTOP: () => { },
  BGSHADEOFF: dummiedCommand,
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
  RND: ({ TEMP_STACK }) => {
    TEMP_STACK[0] = Math.round(Math.random() * 255);
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
  MES: async ({ currentState, STACK }) => {
    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    const { x, y, width, height } = currentState.winSize[channel];

    displayMessage(id, x, y, channel, width, height, false);
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
  RAMESW: async ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const id = STACK.pop() as number;
    const channel = STACK.pop() as number;

    displayMessage(id, x, y, channel);
  },
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
  ASK: (args) => {
    const { STACK } = args;
    // We cannot set x,y with ask, so we spoof it here to reuse AASK
    STACK.push(5);
    STACK.push(5);

    OPCODE_HANDLERS?.AASK?.(args);
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
  ISTOUCH: ({ scene, script, STACK, TEMP_STACK }) => {
    const actorId = STACK.pop() as number;
    const isTouch = isTouching(script.groupId, `entity--${actorId}`, scene)

    TEMP_STACK[0] = isTouch ? 1 : 0;
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

  WAIT: async ({ STACK }) => {
    // Runs at 30FPS
    const psxGameFrames = STACK.pop() as number;
    await wait(psxGameFrames / 30 * 1000);
  },
  // All scripts have a unique label, not sure why other IDs are required in game...
  REQ: ({ STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();
    remoteExecute(label, priority)
  },
  REQSW: ({ STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();
    remoteExecute(label, priority, true)
  },
  REQEW: async ({ script, STACK }) => {
    const label = STACK.pop() as number;
    const priority = STACK.pop();

    console.log('REQEW', script.name, label, priority)
    await remoteExecute(label, priority, true)
  },
  PREQ: ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    console.log('PREQ', partyMemberIndex, label, priority);
    remoteExecutePartyMember(scene, partyMemberIndex, label, priority)
  },
  PREQSW: ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true)
  },
  PREQEW: async ({ currentOpcode, scene, STACK }) => {
    const partyMemberIndex = currentOpcode.param as number;
    const label = STACK.pop() as number;
    const priority = STACK.pop() as number;
    console.log('start preqew', partyMemberIndex, label, priority)
    await remoteExecutePartyMember(scene, partyMemberIndex, label, priority, true)
    console.log('end preqew', partyMemberIndex, label, priority)
  },
  ISPARTY: ({ STACK, TEMP_STACK }) => {
    const characterID = STACK.pop() as number;
    const indexInParty = useGlobalStore.getState().party.indexOf(characterID)
    TEMP_STACK[0] = indexInParty;
  },
  SETPARTY: ({ STACK }) => {
    const character3ID = STACK.pop() as number;
    const character2ID = STACK.pop() as number;
    const character1ID = STACK.pop() as number;

    const uniqueParty = Array.from(new Set([character1ID, character2ID, character3ID])).filter(id => id !== 255);

    useGlobalStore.setState({
      party: uniqueParty
    })
  },
  ADDPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState(state => ({
      ...state,
      party: [...state.party, characterID]
    }))
  },
  SUBPARTY: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      party: useGlobalStore.getState().party.filter(id => id !== characterID)
    });
  },
  GETPARTY: ({ STACK, TEMP_STACK }) => {
    const index = STACK.pop() as number;
    TEMP_STACK[0] = useGlobalStore.getState().party[index];
  },
  SETPC: ({ setState, STACK }) => {
    const partyMemberId = STACK.pop() as number;
    setState({
      partyMemberId,
    })
  },
  ADDMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      availableCharacters: [...useGlobalStore.getState().availableCharacters, characterID]
    });
  },
  SUBMEMBER: ({ STACK }) => {
    const characterID = STACK.pop() as number;
    useGlobalStore.setState({
      availableCharacters: useGlobalStore.getState().availableCharacters.filter(id => id !== characterID),
      party: useGlobalStore.getState().party.filter(id => id !== characterID),
    });
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
  SETMODEL: ({ setState, currentOpcode }) => {
    const modelId = currentOpcode.param;

    setState({
      modelId
    })
  },
  BASEANIME: ({ animationController, currentOpcode, STACK }) => {
    const standAnimationId = currentOpcode.param;
    const runAnimationId = STACK.pop() as number;
    const walkAnimationId = STACK.pop() as number;

    animationController.setIdleAnimations(standAnimationId, runAnimationId, walkAnimationId);
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
  RANIMELOOP: ({ animationController, currentOpcode, }) => {
    const animationId = currentOpcode.param;

    animationController.playAnimation(animationId, {
      isLooping: true,
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
  LADDERANIME: ({ animationController, currentOpcode, STACK }) => {
    const animationId = currentOpcode.param;
    const startFrame = STACK.pop() as number;
    const endFrame = STACK.pop() as number;

    animationController.setLadderAnimation(animationId, startFrame, endFrame);
  },
  LADDERDOWN2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3));
    const middle = vectorToFloatingPoint(STACK.splice(-3)); // middle, not used
    vectorToFloatingPoint(STACK.splice(-3));

    await handleLadder(animationController, movementController, middle, end, false);
  },
  LADDERUP2: async ({ animationController, movementController, STACK }) => {
    const end = vectorToFloatingPoint(STACK.splice(-3));
    const middle = vectorToFloatingPoint(STACK.splice(-3)); // middle, not used
    vectorToFloatingPoint(STACK.splice(-3));

    await handleLadder(animationController, movementController, middle, end, true);
  },
  LADDERUP: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param);
    STACK.splice(-4);
  },
  LADDERDOWN: ({ currentOpcode, STACK }) => {
    console.log(currentOpcode.param);
    STACK.splice(-4);
  },
  ANIMESPEED: ({ animationController, STACK }) => {
    animationController.setAnimationSpeed(STACK.pop() as number)
  },
  ANIMESYNC: async ({ animationController }) => {
    while (!animationController.getIsSafeToMoveOn()) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  ANIMESTOP: ({ animationController }) => {
    animationController.pauseAnimation(true);
  },
  POPANIME: () => { },
  PUSHANIME: () => { },
  UNUSE: ({ setState }) => {
    setState({ isUnused: true })
  },
  USE: ({ setState }) => {
    setState({ isUnused: false })
  },
  THROUGHON: ({ setState }) => {
    setState({ isSolid: false })
  },
  THROUGHOFF: ({ setState }) => {
    setState({ isSolid: true })
  },
  HIDE: ({ setState }) => {
    setState({ isVisible: false })
  },
  SHOW: ({ setState }) => {
    setState({ isVisible: true })
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
  TALKRADIUS: ({ setState, STACK }) => {
    const radius = STACK.pop() as number;
    setState({
      talkRadius: radius,
    })
  },
  PUSHRADIUS: ({ setState, STACK }) => {
    const radius = STACK.pop() as number;
    setState({
      pushRadius: radius,
    })
  },
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
  // We don't use actor codes for REQ etc, this seems to work fine.
  SETGETA: ({ STACK }) => {
    // const actorId = 
    STACK.pop() as number;
  },
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
  MSPEED: ({ movementController, STACK }) => {
    const movementSpeed = STACK.pop() as number;
    movementController.setMovementSpeed(movementSpeed);
  },
  MOVEFLUSH: ({ movementController }) => {
    movementController.stop();
  },
  MOVECANCEL: ({ movementController,  STACK }) => {
    STACK.pop() as number; // could this cancel another entity's movement?
    movementController.stop();
  },
  PMOVECANCEL: () => {},

  MOVESYNC: async ({ movementController }) => {
    while (movementController.getState().position.waypoints) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
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

  // PMOVEA: move to party member
  PMOVEA: async ({ movementController, scene, STACK }) => {
    const distanceToStopAnimationFromTarget = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;

    await movementController.moveToObject(`party--${partyMemberId}`, scene, {
      distanceToStopAnimationFromTarget
    })
  },


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

  // R SET: do not await
  RMOVE: (args) => {
    OPCODE_HANDLERS?.MOVE?.(args);
  },
  RFMOVE: async (args) => {
    OPCODE_HANDLERS?.FMOVE?.(args);
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
  RMOVEA: async (args) => {
    OPCODE_HANDLERS?.MOVEA?.(args);
  },
  RPMOVEA: async (args) => {
    OPCODE_HANDLERS?.PMOVEA?.(args);
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
  UNKNOWN11: async ({ rotationController, STACK }) => {
    const startAngle = STACK.pop() as number;
    const endAngle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(startAngle, 0)
    await rotationController.turnToFaceAngle(endAngle, 0)
  }, // "PIVOT"
  UNKNOWN12: () => {}, // "PIVOT_SYNC"

  // Turn to angle
  CTURNL: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, duration, 'left');
  },
  CTURNR: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, duration, 'right');
  },
  DIR: ({ rotationController, STACK }) => {
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, 0);
  },
  // Forces clockwise turn
  UNKNOWN6: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, duration);
  },
  // Forces counter-clockwise turn
  UNKNOWN7: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, duration);
  },
  // Forces clockwise turn
  UNKNOWN8: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, duration);
  },
  // Forces counter-clockwise turn
  UNKNOWN9: ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    rotationController.turnToFaceAngle(angle, duration);
  },
  LTURNL: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, duration, 'left');
  },
  LTURNR: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, duration, 'right');
  },
  LTURN: async ({ rotationController, STACK }) => {
    const duration = STACK.pop() as number;
    const angle = STACK.pop() as number;
    await rotationController.turnToFaceAngle(angle, duration);
  },

  // Turn to face entity
  CTURN: ({ rotationController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const targetId = STACK.pop() as number;

    rotationController.turnToFaceEntity(`entity--${targetId}`, scene, duration);
  },
  DIRA: ({ rotationController, scene, STACK }) => {
    const targetActorId = STACK.pop() as number;
    rotationController.turnToFaceEntity(`entity--${targetActorId}`, scene, 0);
  },

  // I think this sets rotation to a vector?
  DIRP: ({ rotationController, STACK }) => {
    const z = STACK.pop() as number;
    const y = STACK.pop() as number; 
    const x = STACK.pop() as number;
    
    const directionVector = vectorToFloatingPoint({x, y, z});
    rotationController.turnToFaceDirection(directionVector, 0);
  },
  PLTURN: async ({ rotationController, scene }) => {
    await rotationController.turnToFaceEntity(`party--0`, scene, 0);
  },
  PCTURN: ({  rotationController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;
    rotationController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration);
  },
  // Retrieves the current angle of player
  PDIRA: ({ scene, STACK }) => {
    const partyMemberId = STACK.pop() as number;
    const player = getPartyMemberModelComponent(scene, partyMemberId);
    if (!player) {
      console.warn('No player found for party member ID', partyMemberId);
      return;
    }
    STACK.push((player.userData.rotationController as HandlerArgs['rotationController']).getState().angle.get())
  },


  FACEDIRINIT: ({ setState }) => {
    setState({
      isHeadTrackingPlayer: true,
    })
  },
  FACEDIR: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    
    const directionVector = vectorToFloatingPoint({x, y, z});
    headController.turnToFaceDirection(directionVector, duration);
  },
  FACEDIRA: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const targetActorId = STACK.pop() as number;
    headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration);
  },
  FACEDIRP: ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;
    headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration);
  },
  FACEDIROFF: ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    headController.turnToFaceAngle(0, duration);
  },
  FACEDIRSYNC: async ({ headController }) => {
    while (headController.getState().angle.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  RFACEDIR: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;
    
    const directionVector = vectorToFloatingPoint({x, y, z});
    await headController.turnToFaceDirection(directionVector, duration);
  },
  RFACEDIRA: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const targetActorId = STACK.pop() as number;
    await headController.turnToFaceEntity(`entity--${targetActorId}`, scene, duration);
  },
  RFACEDIRP: async ({ headController, scene, STACK }) => {
    const duration = STACK.pop() as number;
    const partyMemberId = STACK.pop() as number;
    await headController.turnToFaceEntity(`party--${partyMemberId}`, scene, duration);
  },
  RFACEDIROFF: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    await headController.turnToFaceAngle(0, duration)
  },
  // No idea how this differs to facedir. Inverted?
  FACEDIRI: async ({ headController, STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const z = STACK.pop() as number;
    const x = STACK.pop() as number;
    console.log(x,y,z,duration)
    const directionVector = vectorToFloatingPoint({x, y, z});
    await headController.turnToFaceDirection(directionVector, duration);
  },
  // This sets the maximum angle allowed, likely when a model's head loops to follow another entity
  FACEDIRLIMIT: ({ STACK }) => {
    STACK.splice(-3);
  },

  ADDMAGIC: ({ STACK }) => {
    STACK.splice(-3);
  },
  SHADELEVEL: ({ STACK }) => {
    // const shadeLevel = 
    STACK.pop() as number;
  },
  RUNDISABLE: () => {
    useGlobalStore.setState({ isRunEnabled: false });
  },
  RUNENABLE: () => {
    useGlobalStore.setState({ isRunEnabled: true });
  },
  DOORLINEON: ({ setState }) => {
    setState({ isDoorOn: true, })
  },
  DOORLINEOFF: ({ setState }) => {
    setState({ isDoorOn: false, })
  },

  // ?
  MLIMIT: ({ STACK }) => {
    // unknown
    STACK.pop() as number;
  },
  SETROOTTRANS: ({ STACK }) => {
    // unknown
    STACK.pop() as number;
  },
  
  // Initialises music system, not needed
  INITSOUND: () => { },
  MUSICVOLSYNC: () => { },
  MUSICLOAD: ({ STACK }) => {
    const id = STACK.pop() as keyof typeof MUSIC_IDS;
    musicController.preloadMusic(MUSIC_IDS[id]);
  },
  MUSICCHANGE: () => {
    musicController.playMusic();
  },
  MUSICSTOP: ({  STACK }) => {
    const channel = STACK.pop() as 1 | 0;
    musicController.pauseChannel(channel);
  },
  MUSICVOL: ({  STACK }) => {
    const channel = STACK.pop() as number;
    const volume = STACK.pop() as number;
    musicController.setVolume(channel, volume);
  },
  MUSICVOLTRANS: ({  STACK }) => {
    const volume = STACK.pop() as number;
    const duration = STACK.pop() as number;
    const channel = STACK.pop() as number;
    
    musicController.transitionVolume(channel, volume, duration);
  },
  MUSICVOLFADE: ({ STACK }) => {
    STACK.pop() as number; // const startVolume =  //maybe?
    STACK.pop() as number; // const frames =  //maybe?
    STACK.pop() as number; // const endVolume = 
    STACK.pop() as number; // ???
  },
  DUALMUSIC: ({ STACK }) => {
    const volume = STACK.pop() as number; // I think this is a volume value? 0 - 127
    musicController.dualMusic(volume);
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
  DSCROLL: ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, 0, 'camera');
  },
  LSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, duration, 'level');
  },
  CSCROLL: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    setCameraScroll(x, y, duration, 'camera');
  },
  DSCROLL2: async ({ STACK }) => {
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, x, y, 0, 'camera');
  },
  LSCROLL2: ({ STACK }) => {
    const duration = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    const layerID = STACK.pop() as number;

    setLayerScroll(layerID, x, y, duration, 'level');
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

  DSCROLLP: async ({ scene, STACK }) => {
    const partyMemberId = STACK.pop() as number;

    const mesh = getPartyMemberModelComponent(scene, partyMemberId);
    if (!mesh) {
      console.warn('No mesh found for party member ID', partyMemberId, ' DSCROLLP');
      return;
    }
    setCameraAndLayerFocus(mesh, 0);
  },
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
  DSCROLLA: async ({ scene, STACK }) => {
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, 0);
  },
  CSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, duration);
  },
  LSCROLLA: ({ scene, STACK }) => {
    const duration = STACK.pop() as number;
    const actorCode = STACK.pop() as number;

    const mesh = getScriptEntity(scene, actorCode);
    setCameraAndLayerFocus(mesh, duration);
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
  MAPFADEON: () => {
    useGlobalStore.setState({ isMapFadeEnabled: true });
  },
  MAPFADEOFF: () => {
    useGlobalStore.setState({ isMapFadeEnabled: false });
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
  MAPJUMPON: () => {
    useGlobalStore.setState({ isMapJumpEnabled: true });
  },
  MAPJUMPOFF: () => {
    useGlobalStore.setState({ isMapJumpEnabled: false });
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
  KILLTIMER: ({ currentState, setState }) => {
    window.clearTimeout(currentState.countdownTimer);
    setState({
      countdownTimer: undefined,
    })
    
  },
  GETTIMER: ({ currentState, TEMP_STACK }) => {
    TEMP_STACK[0] = currentState.countdownTime
  },
  DISPTIMER: ({ STACK }) => {
    // const y = 
    STACK.pop() as number;
    // const x = 
    STACK.pop() as number;
  },
  SETCAMERA: ({ STACK }) => {
    useGlobalStore.setState({
      activeCameraId: STACK.pop() as number
    })
  },
  SPLIT: async ({ scene, STACK }) => {
    useGlobalStore.setState({
      isPartyFollowing: false
    });

    const controllerPromises: Promise<void>[] = [];
    const member1 = getPartyMemberModelComponent(scene, 0)
    const member1MovementController = member1!.userData.movementController as ReturnType<typeof createMovementController>
    const member1Position = vectorToFloatingPoint(STACK.splice(-3));
    member1MovementController.setMovementSpeed(2560);
    console.log('Moving member1', 'from', member1MovementController.getPosition(), 'to', member1Position);
    controllerPromises.push(member1MovementController.moveToPoint(member1Position));

    const member2 = getPartyMemberModelComponent(scene, 1)
    if (member2) {
      const member2MovementController = member2!.userData.movementController as ReturnType<typeof createMovementController>
      const member2Position = vectorToFloatingPoint(STACK.splice(-3));
      member2MovementController.setMovementSpeed(2560);
      console.log('Moving member2', 'from', member2MovementController.getPosition(), 'to', member2Position);
      member2MovementController.moveToPoint(member2Position);
      controllerPromises.push(member2MovementController.moveToPoint(member2Position));
    }
    
    const member3 = getPartyMemberModelComponent(scene, 2)
    if (member3) {
      const member3MovementController = member3!.userData.movementController as ReturnType<typeof createMovementController>
      const member3Position = vectorToFloatingPoint(STACK.splice(-3));
      member3MovementController.setMovementSpeed(2560);
      console.log('Moving member3', 'from', member3MovementController.getPosition(), 'to', member3Position);
      controllerPromises.push(member3MovementController.moveToPoint(member3Position));
    }

    await Promise.all(controllerPromises);
  },
  JOIN: () => {
    useGlobalStore.setState({
      isPartyFollowing: true
    });
  },

  DOFFSET: async ({ movementController, STACK }) => {
    const z = STACK.pop() as number;
    const y = STACK.pop() as number;
    const x = STACK.pop() as number;

    await movementController.setOffset(x, y, z);
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
  OFFSETSYNC: async ({ movementController}) => {
    while (movementController.getState().offset.goal) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },


  // FAKED
  GAMEOVER: ({ STACK }) => {
    STACK.pop() as number;
    console.error('GAME OVER WHAT DID YOU DO');
  },
  ADDGIL: ({ STACK }) => {
    const gil = STACK.pop() as number;
    MEMORY[72] += gil;
  },
  HASITEM: ({ STACK }) => {
    STACK.pop() as number;
    STACK.push(1);
  },

  
  // SOUND

  FOOTSTEP: ({ currentOpcode, STACK }) => {
    const footstepSoundId = STACK.pop() as number; //footstep pair ID?
    console.log(currentOpcode.param, footstepSoundId)
   // movementController.setFootsteps('FOOTSTEPS', footstepSoundId)
  },
  FOOTSTEPON: ({ movementController }) => {
    movementController.enableFootsteps();
  },
  FOOTSTEPOFF: ({ movementController }) => {
    movementController.disableFootsteps();
  },
  FOOTSTEPCUT: ({ movementController }) => {
    movementController.resetFootsteps();
  },
  FOOTSTEPOFFALL: () => { },
  FOOTSTEPCOPY: dummiedCommand,

  EFFECTPLAY: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const pan = STACK.pop() as number;
    const channel = STACK.pop() as number;
    const sfxId = STACK.pop() as number;
    sfxController.play(sfxId, channel, volume, pan)
  },
  EFFECTPLAY2: ({ currentOpcode, sfxController, STACK }) => {
    const channel = STACK.pop() as number; 
    const volume = STACK.pop() as number; 
    const pan = STACK.pop() as number; 
    const sfxId = currentOpcode.param;
    sfxController.playFieldSound(sfxId, channel, volume, pan)
  },
  // I think the documentation here is incorrect. I believe this loads banks of sounds. It's used in
  // test maps with long sound lists before triggering effectplay2.
  EFFECTLOAD: ({ STACK }) => {
    const soundBankId = STACK.pop() as number; // note: check docs, apparently not normal
    console.log('EFFECTLOAD', soundBankId); 
    //sfxController.playLoopingEffect(loopingBackgroundEffectId)
  },
  SESTOP: ({ sfxController, STACK }) => {
    const channel = STACK.pop() as number;
    sfxController.stop(channel);
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
  ALLSEVOL: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;

    sfxController.setVolume(undefined, volume);
  },
  ALLSEVOLTRANS: ({ sfxController, STACK }) => {
    const volume = STACK.pop() as number;
    const duration = STACK.pop() as number;

    sfxController.setVolume(undefined, volume, duration);
  },


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
  SETBATTLEMUSIC: ({ STACK }) => {
    const musicId = STACK.pop() as number;
    musicController.setBattleMusic(musicId);
  },


  /// MOVIES
  MOVIEREADY: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  // Memory 80 is used to track frames. This is used to fake a movie
  MOVIE: () => {
    MEMORY['80'] = 0;
    const interval = setInterval(() => {
      MEMORY['80'] += 100;
      if (MEMORY['80'] > 3000) {
        clearInterval(interval);
      }
    }, 1000 / 30);
  },
  // Camera movement during movie overlays
  SETDCAMERA: ({ STACK }) => {
    STACK.pop() as number;
  },
  MOVIESYNC: dummiedCommand, // used to sync with a movie, we do not show movies so this is dummied and returns done immediately

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
  SAVEENABLE: ({ STACK }) => {
    // const isEnabled =
    STACK.pop() as number;
  },
  INITTRACE: () => { },
  SHAKE: ({ STACK }) => {
    //const lastFour =
    STACK.splice(-4);
  },
  SHAKEOFF: () => { },
  MACCEL: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
    STACK.pop() as number;
  },
  PARTICLEON: ({ STACK }) => {
    STACK.pop() as number;
  },
  SHADESET: ({ STACK }) => {
    STACK.pop() as number;
  },
  CARDGAME: ({ STACK }) => {
    STACK.splice(-7);
  },
  SETWITCH: ({ STACK }) => {
    STACK.pop() as number;
  },
  PREMAPJUMP2: ({ STACK }) => {
    STACK.pop() as number;
  },
  BATTLE: async ({ STACK }) => {
    STACK.splice(-2);
  },
  BATTLEMODE: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Enables changing party
  PHSENABLE: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Sets draw point ID
  UNKNOWN16: ({ STACK }) => {
    STACK.pop() as number;
  },
  ADDITEM: ({ STACK }) => {
    STACK.splice(-2);
  },
  SETVIBRATE: ({ STACK }) => {
    STACK.splice(-2);
  },
  PHSPOWER: ({ STACK }) => {
    STACK.pop() as number;
  },
  GETCARD: ({ STACK }) => {
    STACK.pop() as number;
  },
  WHOAMI: ({ STACK }) => {
    STACK.pop() as number;
  },
  WHERECARD: ({ STACK }) => {
    STACK.pop() as number;
  },
  MENUTIPS: ({ STACK }) => {
    STACK.pop() as number;
  },
  SETMESSPEED: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  CHOICEMUSIC: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  CROSSMUSIC: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  CHANGEPARTY: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  ADDPASTGIL: ({ STACK }) => {
    STACK.pop() as number;
  },
  ANGELODISABLE: ({ STACK }) => {
    STACK.pop() as number;
  },
  PARTICLESET: ({ STACK }) => {
    STACK.pop() as number;
  },
  SHADEFORM: ({ STACK }) => {
    STACK.splice(-8)
  },
  HOWMANYCARD: ({ STACK }) => {
    STACK.pop() as number;
  },

  // Completely unknown. Mainly used in cmwood maps?
  BROKEN: ({ STACK }) => {
    STACK.splice(-8);
  },
  DISC: ({ STACK }) => {
    STACK.pop() as number;
  },
  LASTIN: ({ STACK }) => {
    STACK.pop() as number;
  },
  MENUNAME: ({ STACK }) => {
    STACK.pop() as number;
  },
  COPYINFO: ({ STACK }) => {
    STACK.pop() as number;
  },
  LASTOUT: dummiedCommand,
  SEALEDOFF: ({ STACK }) => {
    STACK.pop() as number;
  },
  KILLBAR: ({ STACK }) => {
    STACK.pop() as number;
  },
  SETBAR: ({ STACK }) => {
    STACK.splice(-2);
  },
  DISPBAR: ({ STACK }) => {
    STACK.splice(-7);
  },
  SETHP: ({ STACK }) => {
    // I assume actorId + HP
    STACK.splice(-2);
  },
  // Some sort of styling effect: 0/1/2/3
  ACTORMODE: ({ setState, STACK }) => {
    const mode = STACK.pop() as number;
    setState({
      actorMode: mode
    })
  },
  // Removes GFs from character. Unsure if stashes details in memory for recall
  RESETGF: ({ STACK }) => {
    STACK.pop() as number;
  },
  HOLD: ({ STACK }) => {
    STACK.splice(-3);
  },
  AXIS: ({ STACK }) => {
    STACK.splice(-2);
  },
  SETDRAWPOINT: ({ STACK, setState }) => {
    const isDrawPoint = STACK.pop() as number;
    setState({ isDrawPoint: Boolean(isDrawPoint) });
  },
  PARTICLEOFF: ({ STACK }) => {
    STACK.pop() as number;
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN1: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN13: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN14: ({ STACK }) => {
    STACK.pop() as number;
  },
  UNKNOWN15: ({ STACK }) => {
    STACK.pop() as number;
  },
  ADDSEEDLEVEL: ({ STACK }) => {
    STACK.pop() as number;
  },
  SETCARD: ({ STACK }) => {
    STACK.pop() as number;
    STACK.pop() as number;
  },
  POLYCOLORALL: ({ STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    useGlobalStore.setState({
      globalMeshTint: [red, green, blue],
    });
  },
  POLYCOLOR: ({ setState, STACK }) => {
    const blue = STACK.pop() as number;
    const green = STACK.pop() as number;
    const red = STACK.pop() as number;

    setState({
      meshTintColor: [red, green, blue],
    });
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
  SETDRESS: ({ STACK }) => {
    const outfitId = STACK.pop() as number;
    const playerId = STACK.pop() as number;
    console.log('Set dress:', { outfitId, playerId });
    MEMORY[720 + playerId] = outfitId;
  },
  // Used once in the balamb basement. I think it might clear a ladder key?
  KEY: ({ STACK }) => {
    STACK.pop() as number;
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

  DCOLADD: ({ STACK }) => {
    const red = STACK.pop() as number;
    const green = STACK.pop() as number;
    const blue = STACK.pop() as number;
    
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
    const red = STACK.pop() as number;
    const green = STACK.pop() as number;
    const blue = STACK.pop() as number;

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
  COLSYNC: async () => { 
    while (useGlobalStore.getState().isTransitioningColorOverlay) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },
  FADEIN: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(1, 250);
  },
  FADEOUT: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.start(0, 500);
  },
  FADENONE: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(1);
  },
  FADEBLACK: () => {
    const { fadeSpring } = useGlobalStore.getState()
    fadeSpring.set(0);
  },
  FADESYNC: async () => {
    const { fadeSpring } = useGlobalStore.getState();
    while (fadeSpring.isAnimating) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },

  MENUTUTO: () => { },
  TUTO: ({ STACK }) => {
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

  
  LBL: dummiedCommand,

  // Do not touch stack
  REST: dummiedCommand, // heal party and GFs
  REFRESHPARTY: dummiedCommand, // used to ensure party changes are reflected everywhere, afaik
  SWAP: dummiedCommand, // swap party members, works across whole party so probably for Laguna scenes

  // Do not touch stack, not relevant to field
  BATTLEON: dummiedCommand,
  BATTLEOFF: dummiedCommand,
  MENUENABLE: dummiedCommand,
  MENUDISABLE: dummiedCommand,
  BATTLECUT: dummiedCommand,
  MENUSAVE: dummiedCommand,
  SETODIN: dummiedCommand,
  SARALYDISPON: dummiedCommand,
  SARALYDISPOFF: dummiedCommand,
  SARALYON: dummiedCommand,
  SARALYOFF: dummiedCommand,
  MENUPHS: dummiedCommand,
  MENUNORMAL: dummiedCommand,
  DYING: dummiedCommand, // resurrects dead members to 1hp

  // Touch stack
  CLOSEEYES: dummiedCommand,
  UNKNOWN10: dummiedCommand,
  FOLLOWON: () => {
    useGlobalStore.setState({ isPartyFollowing: true });
  },
  FOLLOWOFF: () => {
    useGlobalStore.setState({ isPartyFollowing: false });
  },
  BATTLERESULT: dummiedCommand,

  // Never used ingame (excluding test and bgmast_6 (a weird unused level))
  MOVIECUT: unusedCommand,
  ALLSEPOSTRANS: ({ STACK }) => {
    STACK.splice(-3);
  },
  // This changes the key of background music. It lives on in the test menu, never ingame.
  // We use MP3s so not implementable anyway
  KEYSIGHNCHANGE: ({ STACK }) => {
    STACK.pop() as number;
  },
  // Set: unused, but manipulate stack. here for completeness
  ALLSEPOS: ({ STACK }) => {
    STACK.splice(-1);
  },
  MESW: ({ STACK }) => {
    STACK.splice(-2);
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN17: ({ STACK }) => {
    STACK.pop() as number;
  },
  // @ts-expect-error Not in opcodes list
  UNKNOWN18: ({ STACK }) => {
    STACK.pop() as number;
  },
  NOP: unusedCommand,
  GJMP: unusedCommand,
  DEBUG: unusedCommand,
  ISMEMBER: unusedCommand,
  MESFORCUS: unusedCommand,
  SHADETIMER: unusedCommand,
  STOPVIBRATE: unusedCommand,
  ENDING: unusedCommand,
  BGANIMEFLAG: unusedCommand,
  LSCROLLA2: unusedCommand,
  DSCROLLP2: unusedCommand,
  LSCROLLP2: unusedCommand,
  CSCROLLP2: unusedCommand,
  GETDRESS: unusedCommand,
  RFACEDIRI: unusedCommand,
  PCOPYINFO: unusedCommand,
  AXISSYNC: unusedCommand,
  DSCROLL3: unusedCommand,
  GETHP: unusedCommand,
  KEYON2: unusedCommand,
  OPENEYES: unusedCommand,
  BLINKEYES: unusedCommand,
  SETPARTY2: unusedCommand,

}
