import { useAnimations } from '@react-three/drei'
import { Blending, SkinnedMesh } from 'three'

import { FieldData } from '../Field/Field'

declare global {
  type AskOptions = {
    blocked: number[] | undefined
    cancel: number | undefined
    default: number | undefined
    first: number
    last: number | undefined
  }
  type CameraPanAngle = {
    boundaries: {
      bottom: number
      left: number
      right: number
      top: number
    }
    panX: number
    panY: number
  }
  type CameraScrollTransition = {
    duration: number
    endX: number
    endY: number
    isInProgress: boolean
    positioning: ScrollPositionMode
    startX: number
    startY: number
  }

  type CongaHistory = {
    angle: number
    isClimbingLadder: boolean
    position: Vector3
    speed: number
  }

  interface DocumentEventMap {
    animationEnd: CustomEvent<string>
    executeScript: CustomEvent<ExecuteScriptEventDetail>
    messageClosed: CustomEvent<{ id: string; selectedOption: number }>
    scriptEnd: CustomEvent<string>
    scriptFinished: CustomEvent<{ key: string }>
  }

  type Door = FieldData['doors'][number] & {
    name: string
  }
  interface ExecuteScriptEventDetail {
    isGuaranteed: boolean
    key: string
    priority: number
    scriptLabel: number
  }

  type FormattedGateway = {
    destination: Vector3
    sourceLine: Vector3[]
    target: string
  }

  type Gateway = {
    destinationPoint: VectorLike
    id: string
    source: string
    sourceLine: VectorLike[]
    target: string
  }

  type GltfHandle = {
    animations: useAnimationsReturn
    group: MutableRef<Group>
    materials: {
      [key: string]: MeshStandardMaterial
    }
    nodes: {
      [key: string]: SkinnedMesh
    }
  }

  type Layer = {
    blendType: Blending
    canvas: HTMLCanvasElement
    id: string
    layerID: number
    parameter: number
    renderID: number
    state: number
    z: number
  }

  type Message = {
    askOptions: AskOptions | undefined
    id: string
    isCloseable: boolean
    placement: MessagePlacement
    text: string[]
  }

  type MessagePlacement = {
    channel: number | undefined
    height: number | undefined
    width: number | undefined
    x: number
    y: number
  }

  type MovementFlags = {
    backward: boolean
    forward: boolean
    isWalking: boolean
    left: boolean
    panLeft: boolean
    panRight: boolean
    right: boolean
  }

  type Option = {
    event: string
    text: string
  }

  type RemoteExecutionRequest = {
    key: string
    methodId: string
  }
  type ScriptDump = {
    action: string
    index: number | undefined
    isAsync: boolean
    methodId: string
    opcode: Opcode
    payload: number | string
    scriptLabel: number
    timestamps: number[]
  }

  type ScrollPositionMode = 'camera' | 'level'

  type Tile = FieldData['tiles'][number]

  type useAnimationsReturn = ReturnType<typeof useAnimations>

  type VectorLike = {
    x: number
    y: number
    z: number
  }

  interface Window {
    activeTriangle: null | number | undefined
    closestTriangle: null | number | undefined
    dump: {
      activeRemoteExecutions: Record<string, ScriptDump>
      byScriptLabel: Record<
        number,
        {
          methods: ScriptDump[]
          state: unknown
        }
      >
      log: ScriptDump[]
    }
    getScriptState: (() => unknown)[]
    QUEUES: Record<string, string>
    scriptDump: (dump: ScriptDump) => void
  }

  interface WindowEventMap {
    frame: CustomEvent<{
      action: AnimationAction
      delta: number
      endTime: number
      loops: boolean
    }>
  }
}

export {}
