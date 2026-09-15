import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// The app is bundled by Vite, so its relative imports carry no file extension. Node's own type
// stripping needs one, so fill it in for scripts that import straight out of src/.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) {
        return { shortCircuit: true, url: url.href }
      }
    }
    return nextResolve(specifier, context)
  },
})
