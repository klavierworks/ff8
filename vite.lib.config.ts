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
      // One file per source module, so the dynamically imported Entrypoint keeps a real default
      // export. Merged chunks expose it through a namespace object a host's bundler can tree-shake away.
      output: {
        entryFileNames: '[name].js',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
  },
  plugins: [react(), injectCssPlugin(), dts({ entryRoot: 'src' })],
})
