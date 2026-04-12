import { create } from 'zustand'
import type { Object3D, Vector3 } from 'three';
import MAP_NAMES from './constants/maps';
import type { Howl} from 'howler';
import { FieldData } from './Field/Field';
import createSFXController from './Field/Scripts/Script/SFXController/SFXController';
import { sendToDebugger } from './Debugger/debugUtils';
import WalkmeshMovementController from './Field/WalkMesh/WalkmeshMovement';
import LerpValue from './LerpValue';
import WorldmapMovementController from './Field/Worldmap/WorldmapMovementController';

interface GlobalState {
  isDebugMode: boolean,
  isOfflineSupported: boolean,

  isLoading: boolean,
  isMapSuspended: boolean,

  fieldDirection: number,
  isLoadingSavedGame: boolean,

  characterPosition: Vector3 | undefined,
  pendingCharacterPosition: Vector3 | undefined,

  walkmeshController: WalkmeshMovementController | WorldmapMovementController | undefined,
  currentLocationPlaceName: number,
  fieldId: typeof MAP_NAMES[number] | undefined,
  pendingFieldId: typeof MAP_NAMES[number] | undefined,

  initialAngle: number | undefined,
  hasMoved: boolean,
  isUserControllable: boolean,
  isPlayerClimbingLadder: boolean,
  isRunEnabled: boolean,

  isMapJumpEnabled: boolean,

  availableMessages: string[][],

  currentMessages: Message[],
  messageStyles: Record<number,{
    color: number,
    mode: number,
  }>

  layerScrollAdjustments: Record<number, {
    xOffset: number,
    yOffset: number,
    xScrollSpeed: number,
    yScrollSpeed: number,
  }>,
  layerTints: Record<number, {
    durationIn: number,
    durationOut: number,
    startRed: number,
    startGreen: number,
    startBlue: number,
    endRed: number,
    endGreen: number,
    endBlue: number,
    holdIn: number,
    holdOut: number,
    isLooping: boolean,
  }>,

  colorOverlay: {
    startRed: number,
    startGreen: number,
    startBlue: number,
    endRed: number,
    endGreen: number,
    endBlue: number,
    type: 'additive' | 'subtractive',
    duration: number,
  },
  isTransitioningColorOverlay: boolean,
  fadeSpring: LerpValue,
  isMapFadeEnabled: boolean,

  availableCharacters: number[],
  party: number[],
  sleepingParty: number[];
  congaWaypointHistory: CongaHistory[],
  playerMovementSpeed: number,
  isPartyFollowing: boolean,

  cameraFocusHeight: number,
  cameraFocusObject: Object3D | undefined,
  cameraFocusSpring: LerpValue | undefined,

  globalMeshTint: [number, number, number],

  hasActiveTalkMethod: boolean,
  hasActivePushMethod: boolean,
  lockedTriangles: number[],

  activeCameraId: number,

  backgroundMusicSrc: string | undefined,
  backgroundMusic: Howl | undefined,
  dualMusic: Howl | undefined,

  fieldData: FieldData | undefined,

  systemSfxController: ReturnType<typeof createSFXController>,
  spuValue: number

  backgroundAnimations: Record<number, LerpValue>,
  backgroundLayerVisibility: Record<number, boolean>,
  backgroundLayerSpeeds: Record<number, number>,
  backgroundScrollRatios: Record<number, {
    x: number,
    y: number,
  }>,

  cameraScrollOffset: CameraScrollTransition
  layerScrollOffsets: Record<number, CameraScrollTransition>,
}

const INITIAL_STATE: GlobalState = {
    isDebugMode: false,
    isOfflineSupported: false,

    isLoading: false,
    isMapSuspended: false,
  
    fieldDirection: 0,
    isLoadingSavedGame: false,

  
    availableMessages: [],
    characterPosition: undefined,
    pendingCharacterPosition: undefined,
    fieldId: '' as typeof MAP_NAMES[number],
    pendingFieldId: undefined as unknown as typeof MAP_NAMES[number],

    walkmeshController: undefined,
    currentLocationPlaceName: 0,
    hasMoved: false,
    isPlayerClimbingLadder: false,
    isUserControllable: false,
    isRunEnabled: true,
    initialAngle: undefined,
  
    layerTints: {},
  
    isMapJumpEnabled: true,
  
    currentMessages: [],
    messageStyles: {},
  
    layerScrollAdjustments: {},
    colorOverlay: {
      startRed: 0,
      startGreen: 0,
      startBlue: 0,
      endRed: 0,
      endGreen: 0,
      endBlue: 0,
      type: 'additive',
      duration: 0,
    },
    isTransitioningColorOverlay: false,
    fadeSpring: new LerpValue(1),
    isMapFadeEnabled: true,
  
    availableCharacters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    party: [0],
    sleepingParty: [],

    congaWaypointHistory: [],
    playerMovementSpeed: 0,
    isPartyFollowing: true,
  
    cameraFocusHeight: 0,
    cameraFocusObject: undefined,
    cameraFocusSpring: undefined,

    globalMeshTint: [128, 128, 128],
  
    hasActiveTalkMethod: false,
    hasActivePushMethod: false,

    lockedTriangles: [],
  
    activeCameraId: 0,
  
    backgroundMusicSrc: undefined,
    backgroundMusic: undefined,
    dualMusic: undefined,
  
    fieldData: undefined,

    systemSfxController: createSFXController('world', []),
    spuValue: 0,

    backgroundAnimations: {
      [-1]: new LerpValue(0)
    },
    backgroundLayerVisibility: {},
    backgroundLayerSpeeds: {},
    backgroundScrollRatios: {},

    cameraScrollOffset: {} as CameraScrollTransition,
    layerScrollOffsets: {},
}

const useGlobalStore = create<GlobalState>()(() => ({...INITIAL_STATE}))

useGlobalStore.subscribe((state) => {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fieldData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    systemSfxController,
    ...safeState
  } = state;

  sendToDebugger('state', JSON.stringify(safeState));
});

export default useGlobalStore