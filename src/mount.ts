import { createElement, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import Ff8 from './Ff8/Ff8'
import { offlineController } from './OfflineController'

type MountOptions = {
  assetBaseUrl: string
  shouldRegisterServiceWorker?: boolean
  shouldSyncUrl?: boolean
}

export const mount = (
  element: HTMLElement,
  { assetBaseUrl, shouldRegisterServiceWorker = false, shouldSyncUrl = false }: MountOptions,
) => {
  if (shouldRegisterServiceWorker) {
    offlineController.registerServiceWorker()
  }
  const root = createRoot(element)
  root.render(
    createElement(StrictMode, null, createElement(Suspense, null, createElement(Ff8, { assetBaseUrl, shouldSyncUrl }))),
  )
  return () => root.unmount()
}
