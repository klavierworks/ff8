import type { Howl } from 'howler'
import type { Object3D, Vector3 } from 'three'

import { create } from 'zustand'

import MAP_NAMES from './constants/maps'
import { sendToDebugger } from './Debugger/debugUtils'
import LerpValue from './LerpValue'
import { FieldData } from './modules/field/Field'
import createSFXController from './modules/field/Scripts/Script/SFXController/SFXController'
import WalkmeshMovementController from './modules/field/WalkMesh/WalkmeshMovement'

interface GlobalState {
  activeCameraId: number
  availableCharacters: number[]

  availableMessages: string[][]
  backgroundAnimations: Record<number, LerpValue>

  backgroundLayerSpeeds: Record<number, number>
  backgroundLayerVisibility: Record<number, boolean>

  backgroundMusic: Howl | undefined
  backgroundMusicSrc: string | undefined

  backgroundScrollRatios: Record<
    number,
    {
      x: number
      y: number
    }
  >
  cameraFocusHeight: number
  cameraFocusObject: Object3D | undefined
  cameraFocusSpring: LerpValue | undefined

  cameraScrollOffset: CameraScrollTransition
  characterPosition: undefined | Vector3
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
  isDebugMode: boolean
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
      xScrollSpeed: number
      yOffset: number
      yScrollSpeed: number
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
      startBlue: number
      startGreen: number
      startRed: number
    }
  >
  lockedTriangles: number[]

  messageStyles: Record<
    number,
    {
      color: number
      mode: number
    }
  >

  module: 'battle' | 'field' | 'menu' | 'worldmap'

  party: number[]
  partyMembersFollowing: number[]
  pendingCharacterPosition: undefined | Vector3

  pendingFieldId: (typeof MAP_NAMES)[number] | undefined
  playerMovementSpeed: number
  sleepingParty: number[]
  spuValue: number

  systemSfxController: ReturnType<typeof createSFXController>
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
  backgroundScrollRatios: {},
  cameraFocusHeight: 0,
  cameraFocusObject: undefined,

  cameraFocusSpring: undefined,
  cameraScrollOffset: {} as CameraScrollTransition,
  characterPosition: undefined,
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
  isDebugMode: false,
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

  messageStyles: {},
  module: 'menu',
  party: [0],
  partyMembersFollowing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  pendingCharacterPosition: undefined,

  pendingFieldId: undefined as unknown as (typeof MAP_NAMES)[number],
  playerMovementSpeed: 0,
  sleepingParty: [],
  spuValue: 0,

  systemSfxController: createSFXController('world', []),
  walkmeshController: undefined,
}

const useGlobalStore = create<GlobalState>()(() => ({ ...INITIAL_STATE }))

useGlobalStore.subscribe((state) => {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fieldData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    systemSfxController,
    ...safeState
  } = state

  sendToDebugger('state', JSON.stringify(safeState))
})

export default useGlobalStore
