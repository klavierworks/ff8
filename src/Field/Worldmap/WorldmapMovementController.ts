import { Mesh, Raycaster, Vector3 } from "three";
import WalkmeshMovementController from "../WalkMesh/WalkmeshMovement";
import { WORLD_MAP_MESH_SCALE } from "./Worldmap";
import { IS_FLYING } from "./useWorldMapControls";

const raycaster = new Raycaster();
const direction = new Vector3(0, 0, -1);
raycaster.firstHitOnly = true;

const PERMITTED_Z = 0.05;

class WorldmapMeshController extends WalkmeshMovementController {
  worldmapMesh: Mesh;
  textureCanvas: HTMLCanvasElement | null = null;

  constructor(mesh: Mesh) {
    super(mesh);
    this.worldmapMesh = mesh;
    this.createHitMap();
  }
  private async createHitMap() {
    const map = new Image();
    map.src = '/worldmap/baseColorBlockages.png';
    map.decoding = 'async';
    await map.decode();
    const canvas = document.createElement('canvas');
    canvas.width = map.width;
    canvas.height = map.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    ctx.drawImage(map, 0, 0);
    this.textureCanvas = canvas;
  }

  public getColorAtUv(uv: {x: number, y: number}): Uint8ClampedArray<ArrayBuffer> | null {
    if (!this.textureCanvas) {
      return null;
    }
    const ctx = this.textureCanvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    const x = Math.floor(uv.x * this.textureCanvas.width);
    const y = Math.floor(uv.y * this.textureCanvas.height);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return pixel;
  }

  public getTriangleForPosition(): number | null {
    return -1;
  }

  public getPositionOnWalkmesh(position: Vector3): Vector3 | null {
    const raycastPosition = position.clone();
    raycastPosition.z += 100;
    raycaster.set(raycastPosition, direction);
    const intersections = raycaster.intersectObject(this.worldmapMesh, true);
    if (intersections.length === 0) {
      return position;
    }
    const [hit] = intersections;

    return hit.point;
  }

  public getNextPositionOnWalkmesh(
    currentPosition: Vector3,
    moveDirection: Vector3,
    moveDistance: number,
  ): Vector3 {
    const normalizedDirection = moveDirection.clone().normalize();
    normalizedDirection.z = 0;

    const targetPosition = currentPosition.clone().add(
      normalizedDirection.clone().multiplyScalar(moveDistance)
    );
    const raycastPosition = targetPosition.clone();
    raycastPosition.z += 100;
    raycaster.set(raycastPosition, direction);
    const intersections = raycaster.intersectObject(this.worldmapMesh, true);

    if (intersections.length === 0) {
      return currentPosition;
    }

    const [hit] = intersections;

    if (IS_FLYING) {
      return hit.point;
    }

    const color = this.getColorAtUv(hit.uv!);

    if (color && color[0] > 240) {
      return currentPosition;
    }

    if (color && color[1] > 240) {
      return hit.point;
    }


    if (Math.abs(hit.point.z - currentPosition.z) > PERMITTED_Z) {
      return currentPosition;
    }


    return hit.point;
  }

  getPlayerUV(playerPos: Vector3) {
    const worldBounds = this.worldmapMesh.geometry.boundingBox;
    if (!worldBounds) {
      console.warn('No bounding box on worldmap mesh');
      return { u: 0, v: 0 };
    }
    const playerX = playerPos.x / WORLD_MAP_MESH_SCALE * 2;
    const playerY = playerPos.y / WORLD_MAP_MESH_SCALE * 2;
    const u = (playerX - worldBounds.min.x) / (worldBounds.max.x - worldBounds.min.x);
    const v = (playerY - worldBounds.min.y) / (worldBounds.max.y - worldBounds.min.y);
    return { u: u, v: v }; // Both normalized 0-1
  }
}

export default WorldmapMeshController;