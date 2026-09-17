import { Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { WORLDMAP_STATE } from '../../Scripts/state'
import { isCanopyGroundType, TerrainTriangle } from '../../terrain'
import useScriptTick from '../../useScriptTick'
import { isChocobo } from '../../vehicleClasses'
import useWorldmapStore from '../../worldmapStore'
import { convertFieldDirectionToHeading } from '../playerAngles'
import { readShipPose } from '../shipPose'
import { getChocoboRiderState, RunOff, updateChocoboRiderState } from './chocoboRiderState'
import { advanceCompanionTrail, createCompanionTrail, TrailEntry } from './companionTrailUtils'
import { ChocoboPose } from './runOffUtils'

const isTriangleCanopy = (triangle: TerrainTriangle | undefined) =>
  triangle !== undefined && isCanopyGroundType(triangle.groundType)

const buildChocoboEntry = ({ altitude, heading, triangle, x, z }: ChocoboPose): TrailEntry => ({
  altitude,
  heading,
  isOnCanopy: isTriangleCanopy(triangle),
  x,
  z,
})

const buildPlayerEntry = (position: Vector3, fieldDirection: number): TrailEntry => ({
  ...readShipPose(position),
  heading: convertFieldDirectionToHeading(fieldDirection),
  isOnCanopy: isTriangleCanopy(WORLDMAP_STATE.locationTriangle),
})

const buildTrailSource = (runOff: RunOff, position: Vector3, fieldDirection: number) =>
  runOff.phase === 'idle' ? buildPlayerEntry(position, fieldDirection) : buildChocoboEntry(runOff.pose)

const runTrailTick = () => {
  const { characterPosition, fieldDirection } = useGlobalStore.getState()
  if (!characterPosition) {
    return
  }
  const { runOff, trail } = getChocoboRiderState()
  const source = buildTrailSource(runOff, characterPosition, fieldDirection)
  const current = trail ?? createCompanionTrail(source)
  const next = advanceCompanionTrail(current, source, {
    hasPlayerMoved: WORLDMAP_STATE.isMoving,
    isFollowing: isChocobo(useWorldmapStore.getState().vehicleId) || runOff.phase !== 'idle',
    isRunningOff: runOff.phase === 'running',
  })
  updateChocoboRiderState({ trail: next })
}

const useCompanionTrail = () => {
  useScriptTick(runTrailTick)
}

export default useCompanionTrail
