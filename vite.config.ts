import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { customManifestPlugin } from './vite-custom-manifest-plugin.js'
import { extractorDataPlugin } from './vite-extractor-data-plugin.js'
import { VitePWA } from 'vite-plugin-pwa'

// Must match SITE_ASSET_BASE_URL in src/constants/assets.ts.
const SITE_DATA_URL_PREFIX = '/data/'

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      png: {
        quality: 100,
      },
    }),
    VitePWA({
      strategies: 'injectManifest',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      srcDir: 'src/serviceWorker',
      filename: '_sw.ts',
    }),
    customManifestPlugin(),
    extractorDataPlugin(SITE_DATA_URL_PREFIX),
  ],
})
