import { useThree } from '@react-three/fiber'
import { Camera, Object3D } from 'three'

import { CHOCOBO_RUN_OFF_START_FRAME } from '../../../../constants/worldmapVehicles'
import useScriptTick from '../../useScriptTick'
import { isChocobo } from '../../vehicleClasses'
import useWorldmapStore from '../../worldmapStore'
import { MOVEMENT_FRAME_PRIORITY } from '../constants'
import { findTopFace } from '../shipPose'
import { getChocoboRiderState, RunOff, updateChocoboRiderState } from './chocoboRiderState'
import { advanceRunOffSearch, createRunOffSearch } from './runOffPathUtils'
import { ChocoboPose, hasRunOffWaypointsLeft, isChocoboPoseInView, stepRunningChocobo } from './runOffUtils'

type RunningRunOff = Extract<RunOff, { phase: 'running' }>

type RunOffContext = {
  camera: Camera
  dismountFrame: number
  scene: Object3D
  trailReadIndex: number | undefined
  trailWriteIndex: number
}

const startSearch = (scene: Object3D, pose: ChocoboPose): RunOff => {
  const face = findTopFace(scene, pose.x, pose.z)
  return face
    ? { phase: 'searching', pose, search: createRunOffSearch(face, pose.heading) }
    : { phase: 'finished', pose }
}

const releaseTrailMark = (trailMark: number | undefined, trailReadIndex: number | undefined) =>
  trailMark === trailReadIndex ? undefined : trailMark

const stepRunning = (runOff: RunningRunOff, context: RunOffContext): RunOff => {
  if (!hasRunOffWaypointsLeft(runOff.path, runOff.waypointIndex) || !isChocoboPoseInView(context.camera, runOff.pose)) {
    return { phase: 'finished', pose: runOff.pose }
  }
  const step = stepRunningChocobo(context.scene, runOff.pose, runOff.path, runOff.waypointIndex)
  return { ...runOff, ...step, trailMark: releaseTrailMark(runOff.trailMark, context.trailReadIndex) }
}

const stepRunOff = (runOff: RunOff, context: RunOffContext): RunOff => {
  switch (runOff.phase) {
    case 'finished':
      return isChocobo(useWorldmapStore.getState().vehicleId) ? runOff : { phase: 'idle' }
    case 'running':
      return stepRunning(runOff, context)
    case 'searching': {
      const { isFinished, search } = advanceRunOffSearch(context.scene, runOff.search, context.dismountFrame)
      return isFinished
        ? { path: search.bestPath ?? [], phase: 'waiting', pose: runOff.pose, trailMark: context.trailWriteIndex }
        : { ...runOff, search }
    }
    case 'starting':
      return startSearch(context.scene, runOff.pose)
    case 'waiting':
      return context.dismountFrame >= CHOCOBO_RUN_OFF_START_FRAME
        ? { ...runOff, phase: 'running', waypointIndex: 0 }
        : runOff
    default:
      return runOff
  }
}

const useChocoboRunOff = () => {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  useScriptTick(
    () => {
      const { dismountFrame, runOff, trail } = getChocoboRiderState()
      if (runOff.phase === 'idle') {
        return
      }
      const next = stepRunOff(runOff, {
        camera,
        dismountFrame,
        scene,
        trailReadIndex: trail?.readIndex,
        trailWriteIndex: trail?.writeIndex ?? 0,
      })
      updateChocoboRiderState({ runOff: next })
    },
    { priority: MOVEMENT_FRAME_PRIORITY },
  )
}

export default useChocoboRunOff
