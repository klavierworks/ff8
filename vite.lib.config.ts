import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import packageJson from './package.json'
import { injectCssPlugin } from './vite-inject-css-plugin.js'

const EXTERNAL_PACKAGES = Object.keys(packageJson.dependencies)

const isExternal = (id: string) => EXTERNAL_PACKAGES.some((name) => id === name || id.startsWith(`${name}/`))

export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      entry: 'src/library.ts',
      fileName: 'ff8',
      formats: ['es'],
    },
    outDir: 'dist-lib',
    rollupOptions: {
      external: isExternal,
    },
  },
  plugins: [react(), injectCssPlugin(), dts({ entryRoot: 'src' })],
})
