import { Box3, Vector3 } from 'three'

export const MODEL_LOADER_FIT_FRAMES = 20
export const MODEL_LOADER_MORPH_FRAMES = 30
export const MODEL_LOADER_FADE_FRAMES = 15

export const FIELD_MODEL_PLACEHOLDER_BOUNDS = new Box3(
  new Vector3(-0.0125, -0.0125, 0),
  new Vector3(0.0125, 0.0125, 0.08),
)
