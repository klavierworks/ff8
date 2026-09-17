import { Group, Object3D } from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { VEHICLE_IDS } from '../../../../../constants/vehicles'
import { TARGET_FPS } from '../../../../../timing'
import { buildCharaoneKey } from '../../../charaoneAssets'
import useWorldmapStore, { WORLD_MAP_STATE_FREE_ROAM } from '../../../worldmapStore'
import { getClipFrameCount } from '../../characterAnimationUtils'
import { ANIMATION_SUBFRAMES_PER_KEYFRAME } from '../../constants'
import { getRagnarokOutputs } from '../ragnarokState'

const RAGNAROK_CHARAONE_SECTION = 1
const RAGNAROK_ROOT_PREFIX = 'world_001'

export const RAGNAROK_GLB_KEY = buildCharaoneKey(RAGNAROK_CHARAONE_SECTION)
export const RAGNAROK_DEPLOY_CLIP = 'world_001_action_000'

const ignoreRaycast = () => undefined

const isRagnarokSubtree = (root: Object3D) => root.name.startsWith(RAGNAROK_ROOT_PREFIX)

export const buildRagnarokRoot = (sourceScene: Object3D) => {
  const root = new Group()
  cloneSkinnedScene(sourceScene)
    .children.filter(isRagnarokSubtree)
    .forEach((child) => {
      root.add(child)
    })
  root.traverse((node) => {
    node.raycast = ignoreRaycast
  })
  return root
}

const toKeyframe = (frame: number, keyframeCount: number) =>
  Math.min(Math.floor(frame / ANIMATION_SUBFRAMES_PER_KEYFRAME), keyframeCount - 1)

const calculateShipKeyframe = (keyframeCount: number) => {
  const { vehicleId, worldMapState } = useWorldmapStore.getState()
  if (vehicleId !== VEHICLE_IDS.RAGNAROK) {
    return keyframeCount - 1
  }
  if (worldMapState === WORLD_MAP_STATE_FREE_ROAM) {
    return 0
  }
  return toKeyframe(getRagnarokOutputs().animationFrame, keyframeCount)
}

export const calculateShipClipTime = (clipDuration: number) =>
  calculateShipKeyframe(getClipFrameCount(clipDuration, TARGET_FPS)) / TARGET_FPS
