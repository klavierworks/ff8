import { loadAssetManifest } from '../assetManifest'
import { loadGameData } from '../gameData'

const loadApp = async (assetBaseUrl: string) => {
  await loadAssetManifest(assetBaseUrl)
  await loadGameData()
  // Imported only now because modules across the game read the manifest and game data as they evaluate.
  const { default: App } = await import('../App')
  return App
}

// use() needs the same promise on every render, so each base URL's load is created once.
const appLoads = new Map<string, ReturnType<typeof loadApp>>()

export const getAppLoad = (assetBaseUrl: string) => {
  const existingLoad = appLoads.get(assetBaseUrl)
  if (existingLoad) {
    return existingLoad
  }
  const load = loadApp(assetBaseUrl)
  appLoads.set(assetBaseUrl, load)
  return load
}
