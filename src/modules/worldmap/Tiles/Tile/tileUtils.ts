import { Mesh, Object3D, Texture } from 'three'

import { getMeshMaterials, getTextureMap } from '../tilesUtils'

const SEA_CYCLE_FRAME_COUNT = 6
const SEA_CYCLE_FRAMES_PER_SECOND = 1
const SEA_CYCLE_FRAME_WIDTH = 1 / SEA_CYCLE_FRAME_COUNT
const SPRITE_SHEET_REPEAT_EPSILON = 1e-4

const isSeaCycleSheet = (texture: Texture) =>
  Math.abs(texture.repeat.x - SEA_CYCLE_FRAME_WIDTH) <= SPRITE_SHEET_REPEAT_EPSILON

const getObjectTextureMaps = (object: Object3D) =>
  object instanceof Mesh ? getMeshMaterials(object).map(getTextureMap) : []

export const collectAnimatedTextures = (root: Object3D) => {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    getObjectTextureMaps(object)
      .filter((map): map is Texture => map !== null && isSeaCycleSheet(map))
      .forEach((map) => textures.add(map))
  })
  return Array.from(textures)
}

export const calculateSeaCycleOffsetX = (elapsedSeconds: number) =>
  (Math.floor(elapsedSeconds * SEA_CYCLE_FRAMES_PER_SECOND) % SEA_CYCLE_FRAME_COUNT) * SEA_CYCLE_FRAME_WIDTH
