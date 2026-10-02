import { SITE_ASSET_BASE_URL } from './constants/assets'
import { mount } from './mount'

mount(document.getElementById('root')!, {
  assetBaseUrl: SITE_ASSET_BASE_URL,
  shouldRegisterServiceWorker: true,
  shouldSyncUrl: true,
})
