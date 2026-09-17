import type { WorldmapEffects } from '@data/types/worldmap/WorldmapEffects'

import effectsData from '@data/worldmap/effects.json'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, NearestFilter, NoBlending, PerspectiveCamera, Texture } from 'three'

import { PSX_BLEND_HALF, PSX_BLEND_MODES, PSX_HALF_OPACITY } from '../../../constants/blending'
import useGlobalStore from '../../../store'
import { getScriptFrame } from '../../field/scriptClock'
import useWorldmapStore from '../worldmapStore'
import { createEffectGroups, disposeEffectGroups, EffectGroup, TextureSize, writeEffectGroups } from './effectGeometry'
import { createPlayerMotion } from './effectInputs'
import { createEffectPool } from './effectPool'
import { EffectTickState, runEffectTick } from './effectTick'

const EFFECT_DEFINITIONS = effectsData as WorldmapEffects
const MAX_FRAMES_PER_TICK = 4
const ALPHA_TEST = 0.1
const EFFECTS_RENDER_ORDER = 10
const BYTE_RANGE = 256

const SPRITE_URLS_BY_KEY = import.meta.glob<string>('@data/worldmap/effects/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})
const SPRITE_KEY_PREFIX = '/extractor/data/converted/worldmap/'

const SPRITE_FILES = [
  ...new Set(EFFECT_DEFINITIONS.flatMap((definition) => (definition.sprite ? [definition.sprite.file] : []))),
]
const SPRITE_URLS = SPRITE_FILES.map((file) => SPRITE_URLS_BY_KEY[`${SPRITE_KEY_PREFIX}${file}`])

const getRandomByte = () => Math.floor(Math.random() * BYTE_RANGE)

const setNearestFiltering = (loaded: Texture | Texture[]) => {
  ;[loaded].flat().forEach((texture) => {
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
  })
}

const getMaterialProps = (group: EffectGroup) => {
  if (group.blendMode === undefined) {
    return { blending: NoBlending, depthWrite: true, opacity: 1, transparent: false }
  }
  return {
    blending: PSX_BLEND_MODES[group.blendMode as keyof typeof PSX_BLEND_MODES],
    depthWrite: false,
    opacity: group.blendMode === PSX_BLEND_HALF ? PSX_HALF_OPACITY : 1,
    transparent: true,
  }
}

const buildTextureSizes = (textures: Texture[]) =>
  new Map<string, TextureSize>(
    textures.map((texture, index) => {
      const image = texture.image as TextureSize
      return [SPRITE_FILES[index], { height: image.height, width: image.width }]
    }),
  )

const createTickState = (): EffectTickState => ({
  footLatches: [false, false],
  motion: createPlayerMotion(),
  previousCandidate: -1,
})

const Effects = () => {
  const textures = useTexture(SPRITE_URLS, setNearestFiltering) as Texture[]
  const textureSizes = useMemo(() => buildTextureSizes(textures), [textures])
  const pool = useMemo(createEffectPool, [])
  const groups = useMemo(() => createEffectGroups(EFFECT_DEFINITIONS), [])
  const tickStateRef = useRef(createTickState())
  const lastSteppedFrame = useRef(getScriptFrame())

  useEffect(() => () => disposeEffectGroups(groups), [groups])

  useFrame(({ camera, scene }) => {
    const currentFrame = getScriptFrame()
    const pendingFrames = Math.min(currentFrame - lastSteppedFrame.current, MAX_FRAMES_PER_TICK)
    lastSteppedFrame.current = currentFrame

    for (let frame = 0; frame < pendingFrames; frame += 1) {
      const { characterPosition, fieldDirection } = useGlobalStore.getState()
      const { vehicleId, worldMapState } = useWorldmapStore.getState()
      tickStateRef.current = runEffectTick(
        pool,
        EFFECT_DEFINITIONS,
        tickStateRef.current,
        { characterPosition, fieldDirection, scene, vehicleId, worldMapState },
        getRandomByte,
      )
    }

    writeEffectGroups(groups, pool, EFFECT_DEFINITIONS, camera as PerspectiveCamera, textureSizes)
  })

  return (
    <group name="worldmap-effects">
      {groups.map((group) => (
        <mesh
          frustumCulled={false}
          geometry={group.geometry}
          key={`${group.file}:${group.blendMode}`}
          renderOrder={EFFECTS_RENDER_ORDER}
        >
          <meshBasicMaterial
            alphaTest={group.file ? ALPHA_TEST : 0}
            map={group.file ? textures[SPRITE_FILES.indexOf(group.file)] : null}
            side={DoubleSide}
            vertexColors
            {...getMaterialProps(group)}
          />
        </mesh>
      ))}
    </group>
  )
}

export default Effects
