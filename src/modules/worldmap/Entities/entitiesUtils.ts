import useGlobalStore from '../../../store'
import { runScript, WorldmapScript } from '../Scripts/runScript'
import { beginSpawnCollection, endSpawnCollection, EntityRecord, RawSpawn, WORLDMAP_STATE } from '../Scripts/state'
import { WorldPosition } from '../types'
import { EntityPosition } from '../useSections'
import useWorldmapStore from '../worldmapStore'

// The engine picks two interaction candidates per frame by projecting each
// entity through the camera: a tight ("touching") and a loose ("in vicinity")
// distance. We approximate the projection with planar PSX distance; thresholds
// are tuned to PSX-unit scale (2048 per tile).
const TIGHT_CANDIDATE_DISTANCE = 200
const LOOSE_CANDIDATE_DISTANCE = 600

// While the boarded vehicle is Balamb Garden the picker short-circuits to none:
// you cannot interact with NPCs while flying the school.
const VEHICLE_BLOCKS_INTERACTION = 48

// The spawn slot table caps at 64 entries.
const MAX_ENTITIES = 64

// Type codes 1, 64, 65 read a live vehicle position struct rather than a static
// spawn position; no port equivalent exists yet, so they are skipped.
const VEHICLE_BACKED_TYPES: ReadonlySet<number> = new Set([1, 64, 65])

// Type 80 spawns with subType 4; every other type spawns with subType 0.
const SUBTYPE_FOR_TYPE_80 = 80

const resolveSpawn = (
  typeCode: number,
  positionIndex: number,
  positions: readonly EntityPosition[],
): EntityRecord | undefined => {
  if (VEHICLE_BACKED_TYPES.has(typeCode)) {
    return undefined
  }
  const position = positions[positionIndex]
  if (!position) {
    return undefined
  }
  return {
    pitch: position.pitch,
    positionVerticalY: position.y,
    positionX: position.x,
    positionY: position.z,
    subType: typeCode === SUBTYPE_FOR_TYPE_80 ? 4 : 0,
    typeCode,
    yaw: position.yaw,
  }
}

export const updateEntityDistances = (entities: readonly EntityRecord[], player: WorldPosition) => {
  const distances: Record<number, number> = {}
  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index]
    const dx = entity.positionX - player.psxX
    const dy = entity.positionY - player.psxY
    distances[index] = Math.sqrt(dx * dx + dy * dy)
  }
  useWorldmapStore.setState({ entityDistances: distances })
}

export const resetEntityDistances = () => {
  useWorldmapStore.setState({ entityDistances: {} })
}

const findClosestEntity = (distances: Record<number, number>): { distance: number; index: number } =>
  Object.keys(distances).reduce(
    (closest, key) => {
      const index = Number(key)
      const distance = distances[index]
      return distance < closest.distance ? { distance, index } : closest
    },
    { distance: Infinity, index: -1 },
  )

export const pickCandidates = () => {
  if (useWorldmapStore.getState().vehicleId === VEHICLE_BLOCKS_INTERACTION) {
    WORLDMAP_STATE.tightCandidate = -1
    WORLDMAP_STATE.looseCandidate = -1
    return
  }
  const { distance, index } = findClosestEntity(useWorldmapStore.getState().entityDistances)
  WORLDMAP_STATE.tightCandidate = distance <= TIGHT_CANDIDATE_DISTANCE ? index : -1
  WORLDMAP_STATE.looseCandidate = distance <= LOOSE_CANDIDATE_DISTANCE ? index : -1
}

export const mirrorFacingYaw = () => {
  WORLDMAP_STATE.facingYaw = useGlobalStore.getState().fieldDirection
}

const resolveSpawns = (collector: readonly RawSpawn[], positions: readonly EntityPosition[]): readonly EntityRecord[] =>
  collector
    .flatMap((spawn) => {
      const record = resolveSpawn(spawn.typeCode, spawn.positionIndex, positions)
      return record ? [record] : []
    })
    .slice(0, MAX_ENTITIES)

export const collectEntities = (
  scripts: readonly WorldmapScript[],
  positions: readonly EntityPosition[],
  position: WorldPosition,
): readonly EntityRecord[] => {
  for (const script of scripts) {
    const collector = beginSpawnCollection()
    const result = runScript(script, position)
    endSpawnCollection()
    if (!result.didExecuteBody) {
      continue
    }
    return resolveSpawns(collector, positions)
  }
  return []
}
