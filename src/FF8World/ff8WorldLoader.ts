import { loadAssetManifest } from '../assetManifest'
import { loadGameData } from '../gameData'

const loadEntrypoint = async (assetBaseUrl: string) => {
  await loadAssetManifest(assetBaseUrl)
  await loadGameData()
  // Imported only now because modules across the game read the manifest and game data as they evaluate.
  const { default: Entrypoint } = await import('../Entrypoint/Entrypoint')
  return Entrypoint
}

// use() needs the same promise on every render, so each base URL's load is created once.
const entrypointLoads = new Map<string, ReturnType<typeof loadEntrypoint>>()

export const getEntrypointLoad = (assetBaseUrl: string) => {
  const existingLoad = entrypointLoads.get(assetBaseUrl)
  if (existingLoad) {
    return existingLoad
  }
  const load = loadEntrypoint(assetBaseUrl)
  entrypointLoads.set(assetBaseUrl, load)
  return load
}
