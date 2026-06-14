import { useAnimations, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { Group, LoopOnce, Object3D } from 'three'

import { loadAssetUrl, preloadAssetUrl } from '../../../../../loadAssetUrl'
import { WORLDMAP_SCALE } from '../../../constants'
import useWorldmapStore, {
  WORLD_MAP_STATE_FREE_ROAM,
  WORLD_MAP_STATE_RAGNAROK_LANDING,
  WORLD_MAP_STATE_RAGNAROK_TAKEOFF,
} from '../../../worldmapStore'
import { VEHICLE_RAGNAROK } from '../flightConstants'

const CHARAONE_LOADERS = import.meta.glob<string>('/extractor/data/converted/worldmap/charaone/*.glb', {
  import: 'default',
  query: '?url',
})
const RAGNAROK_GLB_KEY = '/extractor/data/converted/worldmap/charaone/world_001.glb'

// charaone-family base scale: matches the worldmap-entity convention
// (`Entity.tsx` uses `WORLDMAP_SCALE * 100`) so the Ragnarok mesh sits in the
// same coordinate frame as other worldmap content and tracks WORLDMAP_SCALE
// if that constant ever changes.
const RAGNAROK_BASE_SCALE = WORLDMAP_SCALE * 100

// The charaone .gltf files are cumulative: world_001.gltf contains the
// world_000 (Squall) subtree alongside world_001 (Ragnarok). Keep only the
// Ragnarok subtree so the Squall biped doesn't render with the airship.
const RAGNAROK_ROOT_PREFIX = 'world_001'

// Single exported clip — the deploy/fold animation. Per ida.md ("Ragnarok GLTF
// animation"), the engine plays this in reverse for take-off (ship unfolds
// from parked → in-flight) and forward for landing (in-flight → parked), and
// holds at frame 0 while flying. The 60-frame transition window is longer
// than the 0.833s clip; the clip completes early and clamps.
const RAGNAROK_DEPLOY_CLIP = 'world_001_action_000'

const ignoreRaycast = () => undefined

const isRagnarokSubtree = (root: Object3D): boolean => root.name.startsWith(RAGNAROK_ROOT_PREFIX)

// Move the matching subtree (not a clone) into our root: `useGLTF` returns a
// cached scene reference, so we rely on `Ship` being mounted exactly once for
// the lifetime of the worldmap (the parent `Ragnarok` keeps it mounted across
// the on-foot ↔ aboard cycle). Cloning here would orphan the AnimationMixer's
// property bindings on subsequent state changes.
const buildRagnarokRoot = (sourceScene: Object3D): Group => {
  const root = new Group()
  root.name = 'ragnarok_root'
  sourceScene.children.forEach((child) => {
    if (isRagnarokSubtree(child)) {
      root.add(child)
    }
  })
  root.traverse((node) => {
    node.raycast = ignoreRaycast
  })
  return root
}

const Ship = () => {
  const { animations, scene } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, RAGNAROK_GLB_KEY))
  const root = useMemo(() => buildRagnarokRoot(scene), [scene])
  const groupRef = useRef<Group>(null)
  const { actions } = useAnimations(animations, groupRef)
  const worldMapState = useWorldmapStore((state) => state.worldMapState)
  const vehicleId = useWorldmapStore((state) => state.vehicleId)

  useEffect(() => {
    const action = actions[RAGNAROK_DEPLOY_CLIP]
    if (!action) {
      return
    }
    const duration = action.getClip().duration
    action.setLoop(LoopOnce, 1)
    action.clampWhenFinished = true
    action.enabled = true

    if (worldMapState === WORLD_MAP_STATE_RAGNAROK_TAKEOFF) {
      // Unfold: play in reverse, end-frame → frame 0.
      action.stop()
      action.timeScale = -1
      action.time = duration
      action.paused = false
      action.play()
    } else if (worldMapState === WORLD_MAP_STATE_RAGNAROK_LANDING) {
      // Fold: play forward, frame 0 → end frame.
      action.stop()
      action.timeScale = 1
      action.time = 0
      action.paused = false
      action.play()
    } else if (worldMapState === WORLD_MAP_STATE_FREE_ROAM && vehicleId === VEHICLE_RAGNAROK) {
      // Active flight: hold at frame 0 (deployed / in-flight configuration).
      action.stop()
      action.timeScale = 1
      action.time = 0
      action.paused = true
      action.play()
    } else if (worldMapState === WORLD_MAP_STATE_FREE_ROAM) {
      // Parked / not aboard (the ship is rendered inline by `FlyingRagnarok`
      // while the player is on foot): hold at the last frame — the folded
      // configuration the engine selects when the current vehicle isn't the
      // Ragnarok.
      action.stop()
      action.timeScale = 1
      action.time = duration
      action.paused = true
      action.play()
    }
  }, [actions, worldMapState, vehicleId])

  return (
    <group ref={groupRef} scale={RAGNAROK_BASE_SCALE}>
      <primitive object={root} />
    </group>
  )
}

preloadAssetUrl(CHARAONE_LOADERS, RAGNAROK_GLB_KEY, useGLTF.preload)

export default Ship
