import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { offlineController } from './OfflineController'
import Playground from './Playground/Playground'
import { readMountProps } from './Playground/playgroundUtils'

offlineController.registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground mountProps={readMountProps(window.location.search)} />
  </StrictMode>,
)
