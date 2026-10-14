import { loadAssetManifest } from './assetManifest'
import { loadGameData } from './gameData'

export const loadGame = async (assetBaseUrl: string) => {
  await loadAssetManifest(assetBaseUrl)
  await loadGameData()
}
