import { MODEL_LOADER_FADE_FRAMES, MODEL_LOADER_MORPH_FRAMES } from './modelLoader'

export const FIELD_REVEAL_TOGGLE_KEY = 'KeyT'

export const FIELD_REVEAL_COLOR = '#2f9e44'

export const FIELD_INTRO_FADE_SETTLE_FRAMES = 10

export const FIELD_REVEAL_STAGE_FRAMES = {
  background: 90,
  blocks: 30,
  models: MODEL_LOADER_MORPH_FRAMES + MODEL_LOADER_FADE_FRAMES,
  revealed: 15,
  walkmesh: 60,
}

export const BACKGROUND_TILE_FADE_WINDOW = 0.1
