import { BufferAttribute, BufferGeometry, Matrix3, PerspectiveCamera, Vector3 } from 'three'

import { PSX_BLEND_QUARTER_ADD, PSX_QUARTER_INTENSITY } from '../../../constants/blending'
import { WORLDMAP_SCALE } from '../constants'
import {
  buildPsxRotation,
  EFFECT_POOL_SIZE,
  EffectDefinition,
  getEffectAnimationFrame,
  getEffectHalfSize,
  getIsEffectLive,
  LiveEffect,
} from './effectPool'

export type EffectGroup = {
  blendMode: number | undefined
  colors: BufferAttribute
  file: string | undefined
  geometry: BufferGeometry
  positions: BufferAttribute
  quadCount: number
  uvs: BufferAttribute
}

export type TextureSize = {
  height: number
  width: number
}

const CORNERS_PER_QUAD = 4
const INDICES_PER_QUAD = 6
const TEXEL_INSET = 0.5
const COLOR_NEUTRAL = 128
const COLOR_MAX = 255

const SHAPE_GROUND = 0
const SHAPE_SCREEN_WORLD = 2
const SHAPE_GROUND_LONG = 3
const SHAPE_UPRIGHT = 4

const PSX_SCREEN_HEIGHT = 224
const FLAT_EMPTY_SIZE_PIXELS = 8

// Corners in PSX order (top-left, top-right, bottom-left, bottom-right), as multiples of the half
// size in the effect's own rotated frame. PSX Y runs down.
const WORLD_SHAPE_CORNERS: Record<number, readonly (readonly [number, number, number])[]> = {
  [SHAPE_GROUND]: [
    [-1, 0, 1],
    [1, 0, 1],
    [-1, 0, -1],
    [1, 0, -1],
  ],
  [SHAPE_GROUND_LONG]: [
    [-1, 0, 2],
    [1, 0, 2],
    [-1, 0, -2],
    [1, 0, -2],
  ],
  [SHAPE_UPRIGHT]: [
    [-1, -1, 0],
    [1, -1, 0],
    [-1, 1, 0],
    [1, 1, 0],
  ],
}

const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

const _rotation = new Matrix3()
const _corner = new Vector3()
const _center = new Vector3()
const _right = new Vector3()
const _up = new Vector3()
const _forward = new Vector3()
const _toCenter = new Vector3()

const getGroupKey = (definition: EffectDefinition) =>
  definition.sprite ? `${definition.sprite.file}:${definition.blendMode}` : 'flat'

const buildQuadIndices = () =>
  Array.from({ length: EFFECT_POOL_SIZE }, (_, quad) => {
    const base = quad * CORNERS_PER_QUAD
    return [base, base + 1, base + 2, base + 2, base + 1, base + 3]
  }).flat()

const createGroup = (definition: EffectDefinition): EffectGroup => {
  const corners = EFFECT_POOL_SIZE * CORNERS_PER_QUAD
  const positions = new BufferAttribute(new Float32Array(corners * 3), 3)
  const uvs = new BufferAttribute(new Float32Array(corners * 2), 2)
  const colors = new BufferAttribute(new Float32Array(corners * 3), 3)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', uvs)
  geometry.setAttribute('color', colors)
  geometry.setIndex(buildQuadIndices())
  geometry.setDrawRange(0, 0)

  return {
    blendMode: definition.sprite ? definition.blendMode : undefined,
    colors,
    file: definition.sprite?.file,
    geometry,
    positions,
    quadCount: 0,
    uvs,
  }
}

export const createEffectGroups = (definitions: readonly EffectDefinition[]) => {
  const firstByKey = new Map(definitions.map((definition) => [getGroupKey(definition), definition]))
  return [...firstByKey.values()].map(createGroup)
}

export const disposeEffectGroups = (groups: readonly EffectGroup[]) => {
  groups.forEach((group) => group.geometry.dispose())
}

const psxToThree = (x: number, y: number, z: number, target: Vector3) =>
  target.set(x * WORLDMAP_SCALE, -y * WORLDMAP_SCALE, z * WORLDMAP_SCALE)

const writeWorldCorners = (group: EffectGroup, effect: LiveEffect, shape: number, halfSize: number) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  buildPsxRotation(effect.rotation, _rotation)
  WORLD_SHAPE_CORNERS[shape].forEach(([x, y, z], corner) => {
    _corner.set(x * halfSize, y * halfSize, z * halfSize).applyMatrix3(_rotation)
    psxToThree(effect.position.x + _corner.x, effect.position.y + _corner.y, effect.position.z + _corner.z, _corner)
    group.positions.setXYZ(cornerBase + corner, _corner.x, _corner.y, _corner.z)
  })
}

const getWorldUnitsPerPsxPixel = (camera: PerspectiveCamera) => {
  _toCenter.subVectors(_center, camera.position)
  const depth = Math.max(_toCenter.dot(_forward), camera.near)
  return (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / PSX_SCREEN_HEIGHT
}

const writeScreenCorners = (group: EffectGroup, halfWidth: number, halfHeight: number, offset: number) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  SCREEN_CORNERS.forEach(([x, y], corner) => {
    const screenX = x * halfWidth + offset
    const screenY = y * halfHeight + offset
    group.positions.setXYZ(
      cornerBase + corner,
      _center.x + _right.x * screenX - _up.x * screenY,
      _center.y + _right.y * screenX - _up.y * screenY,
      _center.z + _right.z * screenX - _up.z * screenY,
    )
  })
}

const writeCorners = (
  group: EffectGroup,
  effect: LiveEffect,
  definition: EffectDefinition,
  camera: PerspectiveCamera,
) => {
  const halfSize = getEffectHalfSize(effect, definition)
  if (WORLD_SHAPE_CORNERS[definition.shape] && definition.sprite) {
    writeWorldCorners(group, effect, definition.shape, halfSize)
    return
  }

  psxToThree(effect.position.x, effect.position.y, effect.position.z, _center)
  if (definition.shape === SHAPE_SCREEN_WORLD) {
    const halfWorld = halfSize * WORLDMAP_SCALE
    writeScreenCorners(group, halfWorld, halfWorld, 0)
    return
  }

  const unitsPerPixel = getWorldUnitsPerPsxPixel(camera)
  if (definition.sprite) {
    writeScreenCorners(group, halfSize * unitsPerPixel, halfSize * unitsPerPixel, 0)
    return
  }

  // A flat effect is drawn as a rectangle anchored at its top-left corner; one that rounds to no
  // size is widened to eight pixels rather than dropped.
  const sizePixels = halfSize === 0 ? FLAT_EMPTY_SIZE_PIXELS : 2 * halfSize
  const halfExtent = (sizePixels / 2) * unitsPerPixel
  const anchorOffset = (sizePixels / 2 - halfSize) * unitsPerPixel
  writeScreenCorners(group, halfExtent, halfExtent, anchorOffset)
}

const writeTexture = (group: EffectGroup, effect: LiveEffect, definition: EffectDefinition, size: TextureSize) => {
  const sprite = definition.sprite
  if (!sprite) {
    return
  }
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  const frameLeft = sprite.left + getEffectAnimationFrame(effect, sprite) * sprite.width
  const left = (frameLeft + TEXEL_INSET) / size.width
  const right = (frameLeft + sprite.width - TEXEL_INSET) / size.width
  const top = 1 - (sprite.top + TEXEL_INSET) / size.height
  const bottom = 1 - (sprite.top + sprite.height - TEXEL_INSET) / size.height

  group.uvs.setXY(cornerBase, left, top)
  group.uvs.setXY(cornerBase + 1, right, top)
  group.uvs.setXY(cornerBase + 2, left, bottom)
  group.uvs.setXY(cornerBase + 3, right, bottom)
}

const getColorScale = (definition: EffectDefinition) => {
  if (!definition.sprite) {
    return 1 / COLOR_MAX
  }
  const intensity = definition.blendMode === PSX_BLEND_QUARTER_ADD ? PSX_QUARTER_INTENSITY : 1
  return intensity / COLOR_NEUTRAL
}

const writeColor = (group: EffectGroup, definition: EffectDefinition) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  const scale = getColorScale(definition)
  const [red, green, blue] = definition.color
  for (let corner = 0; corner < CORNERS_PER_QUAD; corner += 1) {
    group.colors.setXYZ(cornerBase + corner, red * scale, green * scale, blue * scale)
  }
}

const findGroup = (groups: readonly EffectGroup[], definition: EffectDefinition) =>
  groups.find((group) =>
    definition.sprite
      ? group.file === definition.sprite.file && group.blendMode === definition.blendMode
      : group.file === undefined,
  )

export const writeEffectGroups = (
  groups: readonly EffectGroup[],
  pool: readonly LiveEffect[],
  definitions: readonly EffectDefinition[],
  camera: PerspectiveCamera,
  textureSizes: ReadonlyMap<string, TextureSize>,
) => {
  _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
  _forward.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate()

  groups.forEach((group) => {
    group.quadCount = 0
  })

  pool.forEach((effect) => {
    if (!getIsEffectLive(effect)) {
      return
    }
    const definition = definitions[effect.effectId]
    const group = findGroup(groups, definition)
    const textureSize = definition.sprite ? textureSizes.get(definition.sprite.file) : undefined
    if (!group || group.quadCount >= EFFECT_POOL_SIZE || (definition.sprite && !textureSize)) {
      return
    }
    writeCorners(group, effect, definition, camera)
    if (textureSize) {
      writeTexture(group, effect, definition, textureSize)
    }
    writeColor(group, definition)
    group.quadCount += 1
  })

  groups.forEach((group) => {
    group.geometry.setDrawRange(0, group.quadCount * INDICES_PER_QUAD)
    group.positions.needsUpdate = true
    group.uvs.needsUpdate = true
    group.colors.needsUpdate = true
  })
}
