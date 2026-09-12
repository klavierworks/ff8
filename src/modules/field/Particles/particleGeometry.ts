import { BufferAttribute, BufferGeometry, Object3D, Vector3 } from 'three'

import { PSX_BLEND_MODES, PSX_BLEND_QUARTER_ADD, PSX_QUARTER_INTENSITY } from '../../../constants/blending'
import { PARTICLE_POOL_SIZE, ParticleData, ParticleSprite } from './particleSimulation'

const CORNERS_PER_QUAD = 4
const INDICES_PER_QUAD = 6
const TEXEL_INSET = 0.5

// Screen-space corner offsets in half-size units, ordered top-left, top-right, bottom-left,
// bottom-right. Y runs down, matching the sprite's texture rows.
const CORNER_OFFSETS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

export type ParticleGroup = {
  blendMode: number
  colors: BufferAttribute
  geometry: BufferGeometry
  positions: BufferAttribute
  quadCount: number
  uvs: BufferAttribute
}

const _right = new Vector3()
const _up = new Vector3()
const _towardCamera = new Vector3()
const _center = new Vector3()

const buildQuadIndices = () =>
  Array.from({ length: PARTICLE_POOL_SIZE }, (_, quad) => {
    const base = quad * CORNERS_PER_QUAD
    return [base, base + 1, base + 2, base + 2, base + 1, base + 3]
  }).flat()

const createGroup = (blendMode: number): ParticleGroup => {
  const corners = PARTICLE_POOL_SIZE * CORNERS_PER_QUAD
  const positions = new BufferAttribute(new Float32Array(corners * 3), 3)
  const uvs = new BufferAttribute(new Float32Array(corners * 2), 2)
  const colors = new BufferAttribute(new Float32Array(corners * 3), 3)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', uvs)
  geometry.setAttribute('color', colors)
  geometry.setIndex(buildQuadIndices())
  geometry.setDrawRange(0, 0)

  return { blendMode, colors, geometry, positions, quadCount: 0, uvs }
}

export const createParticleGroups = (data: ParticleData) => {
  const blendModes = new Set(data.types.flatMap((type) => type.keyframes.map((keyframe) => keyframe.blendMode)))

  return [...blendModes]
    .filter((blendMode) => blendMode in PSX_BLEND_MODES)
    .sort()
    .map(createGroup)
}

export const disposeParticleGroups = (groups: readonly ParticleGroup[]) => {
  groups.forEach((group) => group.geometry.dispose())
}

// A type's depth bias shifts how far away the sprite sorts, which a depth buffer reproduces
// by pushing the quad that far along the view axis.
const writeCorners = (group: ParticleGroup, sprite: ParticleSprite) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  const cosine = Math.cos(sprite.rotation)
  const sine = Math.sin(sprite.rotation)
  _center.copy(sprite.position).addScaledVector(_towardCamera, -sprite.depthOffset)

  CORNER_OFFSETS.forEach(([offsetX, offsetY], corner) => {
    const cornerX = offsetX * sprite.halfWidth
    const cornerY = offsetY * sprite.halfHeight
    const screenX = cornerX * cosine - cornerY * sine
    const screenY = cornerX * sine + cornerY * cosine

    group.positions.setXYZ(
      cornerBase + corner,
      _center.x + _right.x * screenX - _up.x * screenY,
      _center.y + _right.y * screenX - _up.y * screenY,
      _center.z + _right.z * screenX - _up.z * screenY,
    )
  })
}

const writeTexture = (group: ParticleGroup, sprite: ParticleSprite, textureWidth: number, textureHeight: number) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  const left = (sprite.textureLeft + TEXEL_INSET) / textureWidth
  const right = (sprite.textureLeft + sprite.textureWidth - TEXEL_INSET) / textureWidth
  const top = 1 - (sprite.textureTop + TEXEL_INSET) / textureHeight
  const bottom = 1 - (sprite.textureTop + sprite.textureHeight - TEXEL_INSET) / textureHeight

  group.uvs.setXY(cornerBase, left, top)
  group.uvs.setXY(cornerBase + 1, right, top)
  group.uvs.setXY(cornerBase + 2, left, bottom)
  group.uvs.setXY(cornerBase + 3, right, bottom)
}

const writeColor = (group: ParticleGroup, sprite: ParticleSprite) => {
  const cornerBase = group.quadCount * CORNERS_PER_QUAD
  const intensity = sprite.blendMode === PSX_BLEND_QUARTER_ADD ? PSX_QUARTER_INTENSITY : 1

  for (let corner = 0; corner < CORNERS_PER_QUAD; corner += 1) {
    group.colors.setXYZ(cornerBase + corner, sprite.red * intensity, sprite.green * intensity, sprite.blue * intensity)
  }
}

export const writeParticleGroups = (
  groups: readonly ParticleGroup[],
  sprites: readonly ParticleSprite[],
  spriteCount: number,
  camera: Object3D,
  textureWidth: number,
  textureHeight: number,
) => {
  _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
  _towardCamera.setFromMatrixColumn(camera.matrixWorld, 2).normalize()

  groups.forEach((group) => {
    group.quadCount = 0
  })

  for (let index = 0; index < spriteCount; index += 1) {
    const sprite = sprites[index]
    const group = groups.find((candidate) => candidate.blendMode === sprite.blendMode)
    if (!group || group.quadCount >= PARTICLE_POOL_SIZE) {
      continue
    }

    writeCorners(group, sprite)
    writeTexture(group, sprite, textureWidth, textureHeight)
    writeColor(group, sprite)
    group.quadCount += 1
  }

  groups.forEach((group) => {
    group.geometry.setDrawRange(0, group.quadCount * INDICES_PER_QUAD)
    group.positions.needsUpdate = true
    group.uvs.needsUpdate = true
    group.colors.needsUpdate = true
  })
}
