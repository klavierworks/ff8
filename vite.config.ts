import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { customManifestPlugin } from './vite-custom-manifest-plugin.js'
import { extractorDataPlugin } from './vite-extractor-data-plugin.js'
import { VitePWA } from 'vite-plugin-pwa'

const MOUNT_ENTRY = 'ff8'
// Must match SITE_ASSET_BASE_URL in src/constants/assets.ts, which the site passes to mount().
const SITE_DATA_URL_PREFIX = '/data/'
const STYLE_ELEMENT_ID = 'ff8-styles'

const createStyleInjection = (css: string) =>
  `(()=>{if(typeof document==="undefined"||document.getElementById(${JSON.stringify(STYLE_ELEMENT_ID)}))return;` +
  `const style=document.createElement("style");style.id=${JSON.stringify(STYLE_ELEMENT_ID)};` +
  `style.textContent=${JSON.stringify(css)};document.head.appendChild(style)})();\n`

// A host loads ff8.js without our index.html, so the stylesheet travels inside each entry chunk
// rather than as a <link> the host would have to add.
const injectCssIntoEntries = (): Plugin => ({
  name: 'inject-css-into-entries',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const files = Object.values(bundle)
    const stylesheets = files.filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
    const css = stylesheets.map((file) => (file.type === 'asset' ? String(file.source) : '')).join('')
    stylesheets.forEach((file) => {
      delete bundle[file.fileName]
    })
    files.forEach((file) => {
      if (file.type === 'chunk' && file.isEntry) {
        file.code = `${createStyleInjection(css)}${file.code}`
      }
      if (file.type === 'asset' && file.fileName.endsWith('.html')) {
        file.source = String(file.source).replace(/<link rel="stylesheet"[^>]*>\s*/g, '')
      }
    })
  },
})

export default defineConfig({
  base: './',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: 'index.html',
        [MOUNT_ENTRY]: 'src/mount.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === MOUNT_ENTRY ? `${MOUNT_ENTRY}.js` : 'assets/[name]-[hash].js'),
      },
      preserveEntrySignatures: 'exports-only',
    },
  },
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
    injectCssIntoEntries(),
  ],
})
