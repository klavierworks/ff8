import { createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { loadAssetManifest } from './assetManifest'
import { loadGameData } from './gameData'
import { offlineController } from './OfflineController'

type MountOptions = {
  assetBaseUrl: string
  shouldRegisterServiceWorker?: boolean
  shouldSyncUrl?: boolean
}

export const mount = async (
  element: HTMLElement,
  { assetBaseUrl, shouldRegisterServiceWorker = false, shouldSyncUrl = false }: MountOptions,
) => {
  if (shouldRegisterServiceWorker) {
    offlineController.registerServiceWorker()
  }
  await loadAssetManifest(assetBaseUrl)
  await loadGameData()
  // Imported only now because modules across the game read the manifest and game data as they evaluate.
  const { default: App } = await import('./App')
  const root = createRoot(element)
  root.render(createElement(StrictMode, null, createElement(App, { shouldSyncUrl })))
  return () => root.unmount()
}
