import { createElement, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import Ff8 from './Ff8/Ff8'

type MountOptions = {
  assetBaseUrl: string
}

export const mount = (element: HTMLElement, { assetBaseUrl }: MountOptions) => {
  const root = createRoot(element)
  root.render(createElement(StrictMode, null, createElement(Suspense, null, createElement(Ff8, { assetBaseUrl }))))
  return () => root.unmount()
}
