import type cards from '@data/exe/cards.json'
import type drawPoints from '@data/exe/draw-points.json'
import type gateways from '@data/field/gateways_index.json'
import type fieldModels from '@data/field/models/manifest.json'
import type magic from '@data/kernel/magic.json'
import type areaNames from '@data/menu/area-names.json'
import type nameDictionary from '@data/menu/namedic.json'
import type movies from '@data/movies/manifest.json'
import type effects from '@data/worldmap/effects.json'
import type rails from '@data/worldmap/rails.json'
import type sections from '@data/worldmap/sections.json'
import type worldmapToField from '@data/worldmap/wm2field.json'

import { fetchAssetJson } from './assetManifest'
import { GAME_DATA_PATHS } from './constants/assets'

type GameData = {
  areaNames: typeof areaNames
  cards: typeof cards
  drawPoints: typeof drawPoints
  effects: typeof effects
  fieldModels: typeof fieldModels
  gateways: typeof gateways
  magic: typeof magic
  movies: typeof movies
  nameDictionary: typeof nameDictionary
  rails: typeof rails
  sections: typeof sections
  worldmapToField: typeof worldmapToField
}

let gameData: GameData | undefined

export const loadGameData = async () => {
  const entries = await Promise.all(
    Object.entries(GAME_DATA_PATHS).map(async ([key, path]) => [key, await fetchAssetJson(path)] as const),
  )
  gameData = Object.fromEntries(entries) as GameData
}

export const getGameData = () => {
  if (!gameData) {
    throw new Error('Game data read before loadGameData finished')
  }
  return gameData
}
