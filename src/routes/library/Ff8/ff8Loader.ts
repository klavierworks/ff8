import { loadGame } from '../../../loadGame'

const loadHostedGame = async (assetBaseUrl: string) => {
  await loadGame(assetBaseUrl)
  // Game modules read the loaded game data as they evaluate, so they are imported only once it exists.
  const { default: HostedGame } = await import('./HostedGame/HostedGame')
  return HostedGame
}

// use() needs the same promise on every render, so each base URL's load is created once.
const hostedGameLoads = new Map<string, ReturnType<typeof loadHostedGame>>()

export const getHostedGameLoad = (assetBaseUrl: string) => {
  const existingLoad = hostedGameLoads.get(assetBaseUrl)
  if (existingLoad) {
    return existingLoad
  }
  const load = loadHostedGame(assetBaseUrl)
  hostedGameLoads.set(assetBaseUrl, load)
  return load
}
