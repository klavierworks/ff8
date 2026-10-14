import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { SITE_ASSET_BASE_URL } from '../../constants/assets'
import { loadGame } from '../../loadGame'
import { offlineController } from '../../OfflineController'

const startPreview = async () => {
  offlineController.registerServiceWorker()
  await loadGame(SITE_ASSET_BASE_URL)

  // Game modules read the loaded game data as they evaluate, so they are imported only once it exists.
  const [{ initialiseFromUrl }, { default: Preview }] = await Promise.all([
    import('./initialiseFromUrl'),
    import('./Preview/Preview'),
  ])
  const namedField = initialiseFromUrl(window.location.search)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Preview hasNamedField={namedField !== null} />
    </StrictMode>,
  )
}

startPreview()
