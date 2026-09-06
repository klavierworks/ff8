import type { Howl } from 'howler'
import type { Object3D, Vector3 } from 'three'

import { create } from 'zustand'

import MAP_NAMES from './constants/maps'
import LerpValue from './LerpValue'
import { FieldData } from './modules/field/Field'
import createSFXController from './modules/field/Scripts/Script/SFXController/SFXController'
import WalkmeshMovementController from './modules/field/WalkMesh/WalkmeshMovement'

type GlobalState = {
  activeCameraId: number
  availableCharacters: number[]

  availableMessages: string[][]
  backgroundAnimations: Record<number, LerpValue>

  backgroundLayerSpeeds: Record<number, number>
  backgroundLayerVisibility: Record<number, boolean>

  backgroundMusic: Howl | undefined
  backgroundMusicSrc: string | undefined

  cameraFocusHeight: number
  cameraFocusObject: Object3D | undefined
  cameraFocusSpring: LerpValue | undefined

  cameraScrollOffset: CameraScrollTransition
  characterPosition: undefined | Vector3
  characterSpawnTriangle: number | undefined
  colorOverlay: {
    duration: number
    endBlue: number
    endGreen: number
    endRed: number
    startBlue: number
    startGreen: number
    startRed: number
    type: 'additive' | 'subtractive'
  }
  congaWaypointHistory: CongaHistory[]
  currentLocationPlaceName: number

  currentMessages: Message[]

  dualMusic: Howl | undefined

  fadeSpring: LerpValue
  fieldData: FieldData | undefined

  fieldDirection: number
  fieldId: (typeof MAP_NAMES)[number] | undefined
  globalMeshTint: [number, number, number]

  hasActivePushMethod: boolean
  hasActiveTalkMethod: boolean
  hasMoved: boolean
  initialAngle: number | undefined

  inventory: Record<number, number>

  isCardGameActive: boolean
  isDebugMode: boolean
  isLagunaDream: boolean
  isLoading: boolean
  isLoadingSavedGame: boolean
  isMapFadeEnabled: boolean
  isMapJumpEnabled: boolean
  isMapSuspended: boolean

  isOfflineSupported: boolean
  isPlayerClimbingLadder: boolean

  isRunEnabled: boolean

  isTransitioningColorOverlay: boolean
  isUserControllable: boolean
  layerScrollAdjustments: Record<
    number,
    {
      xOffset: number
      xRatio: number
      yOffset: number
      yRatio: number
    }
  >

  layerScrollOffsets: Record<number, CameraScrollTransition>

  layerTints: Record<
    number,
    {
      durationIn: number
      durationOut: number
      endBlue: number
      endGreen: number
      endRed: number
      holdIn: number
      holdOut: number
      isLooping: boolean
      progress: LerpValue
      startBlue: number
      startGreen: number
      startRed: number
    }
  >
  lockedTriangles: number[]
  messageSpeeds: Record<number, number>
  messageStyles: Record<
    number,
    {
      color: number
      mode: number
    }
  >

  module: 'battle' | 'field' | 'menu' | 'worldmap'

  ownedCards: Record<number, number>

  party: number[]

  partyMembersFollowing: number[]
  pendingCharacterPosition: undefined | Vector3
  pendingCharacterTriangle: number | undefined
  pendingFieldId: (typeof MAP_NAMES)[number] | undefined

  playerMovementSpeed: number
  sleepingParty: number[]
  spuValue: number
  systemSfxController: ReturnType<typeof createSFXController>

  // Mirror of `useWorldmapStore.vehicleId` for cross-module consumers (Tiles,
  // field code, etc.) — kept in sync by the worldmap store subscription in
  // Worldmap.tsx. The canonical source of truth is the worldmap store; this
  // copy exists so non-worldmap modules can read it without that dependency.
  vehicleId: number
  walkmeshController: undefined | WalkmeshMovementController
}

const INITIAL_STATE: GlobalState = {
  activeCameraId: 0,
  availableCharacters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

  availableMessages: [],
  backgroundAnimations: {
    [-1]: new LerpValue(0),
  },

  backgroundLayerSpeeds: {},
  backgroundLayerVisibility: {},

  backgroundMusic: undefined,
  backgroundMusicSrc: undefined,
  cameraFocusHeight: 0,
  cameraFocusObject: undefined,

  cameraFocusSpring: undefined,
  cameraScrollOffset: {} as CameraScrollTransition,
  characterPosition: undefined,
  characterSpawnTriangle: undefined,
  colorOverlay: {
    duration: 0,
    endBlue: 0,
    endGreen: 0,
    endRed: 0,
    startBlue: 0,
    startGreen: 0,
    startRed: 0,
    type: 'additive',
  },
  congaWaypointHistory: [],
  currentLocationPlaceName: 0,
  currentMessages: [],

  dualMusic: undefined,

  fadeSpring: new LerpValue(1),

  fieldData: undefined,
  fieldDirection: 0,

  fieldId: '' as (typeof MAP_NAMES)[number],
  globalMeshTint: [128, 128, 128],
  hasActivePushMethod: false,
  hasActiveTalkMethod: false,
  hasMoved: false,
  initialAngle: undefined,

  inventory: {},

  isCardGameActive: false,
  isDebugMode: false,
  isLagunaDream: false,
  isLoading: false,
  isLoadingSavedGame: false,

  isMapFadeEnabled: true,
  isMapJumpEnabled: true,
  isMapSuspended: false,

  isOfflineSupported: false,
  isPlayerClimbingLadder: false,

  isRunEnabled: true,

  isTransitioningColorOverlay: false,
  isUserControllable: false,

  layerScrollAdjustments: {},

  layerScrollOffsets: {},

  layerTints: {},
  lockedTriangles: [],
  messageSpeeds: {},
  messageStyles: {},

  module: 'menu',
  ownedCards: {
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
    16: 1,
    24: 1,
    35: 1,
    47: 1,
    50: 1,
    72: 1,
    84: 1,
    89: 1,
    96: 1,
    109: 1,
  },
  party: [0, 1, 2],
  partyMembersFollowing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  pendingCharacterPosition: undefined,
  pendingCharacterTriangle: undefined,
  pendingFieldId: undefined,

  playerMovementSpeed: 0,
  sleepingParty: [],
  spuValue: 0,
  systemSfxController: createSFXController('world', []),

  vehicleId: 128,
  walkmeshController: undefined,
}

const useGlobalStore = create<GlobalState>()(() => ({ ...INITIAL_STATE }))

export default useGlobalStore
