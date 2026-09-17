import { Vector3 } from 'three'

import { WORLDMAP_LANDING_YAW_SCALE } from '../../constants/worldmapCamera'
import {
  WORLDMAP_ENTRY_DELAY_FRAMES,
  WORLDMAP_ENTRY_FROM_FIELD,
  WORLDMAP_ENTRY_FROM_MENU,
  WORLDMAP_MENU_ENTRY_DELAY_FRAMES,
  WORLDMAP_RESTORE_SPAWN_POINT,
} from '../../constants/worldmapTransitions'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection } from './Player/playerAngles'
import {
  createSpawnPosition,
  getSpawnFieldDirection,
  psxXToWorld,
  psxZToWorld,
  worldXToPsx,
  worldZToPsx,
} from './Player/playerUtils'
import { psxHeightToWorldY, worldYToPsxHeight } from './terrain'
import { FieldLandingPosition } from './useSections'
import { Memory, readSavedPartyState, readSavedVehiclePosition, SavedVehiclePosition } from './worldmapSaveData'

export type WorldmapEntry = {
  cameraYaw: number
  fieldDirection: number
  position: Vector3
}

type WorldmapEntryRequest = {
  entryMode: number
  landings: readonly FieldLandingPosition[]
  memory: Memory
  spawnPointId: number
  vehicleId: number
}

export const getEntryDelayFrames = (entryMode: number) =>
  entryMode === WORLDMAP_ENTRY_FROM_MENU ? WORLDMAP_MENU_ENTRY_DELAY_FRAMES : WORLDMAP_ENTRY_DELAY_FRAMES

const isRestoringFromSave = (entryMode: number, spawnPointId: number) =>
  entryMode !== WORLDMAP_ENTRY_FROM_FIELD || spawnPointId === WORLDMAP_RESTORE_SPAWN_POINT

const buildLandingEntry = (landing: FieldLandingPosition): WorldmapEntry => ({
  cameraYaw: landing.player_yaw * WORLDMAP_LANDING_YAW_SCALE,
  fieldDirection: getSpawnFieldDirection(landing),
  position: createSpawnPosition(landing),
})

const buildSavedEntry = (saved: SavedVehiclePosition, cameraYaw: number): WorldmapEntry => ({
  cameraYaw,
  fieldDirection: convertHeadingToFieldDirection(saved.yaw),
  position: new Vector3(psxXToWorld(saved.x), psxHeightToWorldY(saved.altitude), psxZToWorld(saved.y)),
})

const findSavedEntry = (memory: Memory, vehicleId: number) => {
  const saved = readSavedVehiclePosition(memory, vehicleId)
  return saved ? buildSavedEntry(saved, readSavedPartyState(memory).cameraYaw) : undefined
}

const findLandingEntry = (landings: readonly FieldLandingPosition[], spawnPointId: number) =>
  buildLandingEntry(landings[spawnPointId] ?? landings[0])

export const resolveWorldmapEntry = ({ entryMode, landings, memory, spawnPointId, vehicleId }: WorldmapEntryRequest) =>
  (isRestoringFromSave(entryMode, spawnPointId) ? findSavedEntry(memory, vehicleId) : undefined) ??
  findLandingEntry(landings, spawnPointId)

export const buildSavedVehiclePosition = (position: Vector3, fieldDirection: number): SavedVehiclePosition => ({
  altitude: Math.round(worldYToPsxHeight(position.y)),
  x: Math.round(worldXToPsx(position.x)),
  y: Math.round(worldZToPsx(position.z)),
  yaw: Math.round(convertFieldDirectionToHeading(fieldDirection)),
})
