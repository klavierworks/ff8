import { useAnimations } from "@react-three/drei";
import { Blending, SkinnedMesh } from "three";
import { FieldData } from "../Field/Field";

declare global {
  type ScriptDump = {
    timestamps: number[],
    action: string,
    methodId: string,
    scriptLabel: number,
    opcode: Opcode,
    payload: string | number;
    index: number | undefined,
    isAsync: boolean,
  }
  interface Window {
    QUEUES: Record<string, string>,
    scriptDump: (dump: ScriptDump) => void,
    dump: {
      log: ScriptDump[],
      byScriptLabel: Record<number, {
        methods: ScriptDump[],
        state: unknown,
      }>,
      activeRemoteExecutions: Record<string, ScriptDump>
    }
    getScriptState: (() => unknown)[],
    activeTriangle: number | null | undefined,
    closestTriangle: number | null | undefined,
  }
  interface WindowEventMap {
    // Define your custom event type
    frame: CustomEvent<{
      action: AnimationAction;
      endTime: number;
      loops: boolean;
      delta: number;
    }>;
  }

  interface ExecuteScriptEventDetail {
    key: string;
    scriptLabel: number;
    priority: number;
    isGuaranteed: boolean;
  }

  type RemoteExecutionRequest = {
    key: string;
    methodId: string;
  }

  // Extend the existing DocumentEventMap interface
  interface DocumentEventMap {
    'executeScript': CustomEvent<ExecuteScriptEventDetail>;
    'scriptFinished': CustomEvent<{ key: string }>;
    'scriptEnd': CustomEvent<string>;
    'animationEnd': CustomEvent<string>;
    'messageClosed': CustomEvent<{ id: string, selectedOption: number }>;
  }
  type MovementFlags = {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    isWalking: boolean;
    panLeft: boolean;
    panRight: boolean;
  };


  type CameraPanAngle = {
    boundaries: {
      left: number,
      right: number,
      bottom: number,
      top: number,
    },
    panX: number,
    panY: number
  }

  type VectorLike = {
    x: number,
    y: number,
    z: number
  }

  type Gateway = {
    id: string,
    source: string
    target: string;
    sourceLine: VectorLike[],
    destinationPoint: VectorLike;
  }


  type FormattedGateway = {
    target: string;
    sourceLine: Vector3[]
    destination: Vector3;
  }

  type Option = {
    text: string;
    event: string;
  }

  type Message = {
    id: string;
    text: string[];
    placement: MessagePlacement;
    askOptions: AskOptions | undefined;
    isCloseable: boolean;
  }

  type MessagePlacement = {
    x: number;
    y: number;
    width: number | undefined;
    height: number | undefined;
    channel: number | undefined;
  }

  type AskOptions = {
    first: number;
    last: number | undefined;
    default: number | undefined;
    cancel: number | undefined;
    blocked: number[] | undefined;
  }

  type useAnimationsReturn = ReturnType<typeof useAnimations>
  type GltfHandle = {
    animations: useAnimationsReturn
    group: MutableRef<Group>
    nodes: {
      [key: string]: SkinnedMesh
    }
    materials: {
      [key: string]: MeshStandardMaterial
    }
  }

  type CongaHistory = {
    position: Vector3;
    angle: number;
    speed: number;
    isClimbingLadder: boolean;
  }


  type Layer = {
    blendType: Blending;
    canvas: HTMLCanvasElement;
    layerID: number;
    renderID: number;
    id: string;
    parameter: number;
    state: number;
    z: number;
  }

  type Tile = FieldData['tiles'][number];

  type Door = FieldData['doors'][number] & {
    name: string;
  };

  type ScrollPositionMode = 'camera' | 'level';

  type CameraScrollTransition = {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
    isInProgress: boolean;
    positioning: ScrollPositionMode;
  }
}

export { };