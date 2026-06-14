// Converted assets live outside `public`, so they are referenced through `import.meta.glob`.
// The glob is kept lazy (a map of `() => import('…?url')` thunks) so loading one field does
// not pull in every field's assets; this resolves a single thunk on demand, suspending via a
// thrown promise until the url is ready and caching it. Call only inside a Suspense boundary.

type UrlLoaders = Record<string, () => Promise<string>>

const resolvedUrls = new Map<string, string>()
const pendingUrls = new Map<string, Promise<unknown>>()

export const loadAssetUrl = (loaders: UrlLoaders, key: string | undefined): string => {
  if (!key || !loaders[key]) {
    throw new Error(`No bundled asset for ${key}`)
  }
  const resolved = resolvedUrls.get(key)
  if (resolved !== undefined) {
    return resolved
  }
  let pending = pendingUrls.get(key)
  if (!pending) {
    pending = loaders[key]().then((url) => {
      resolvedUrls.set(key, url)
    })
    pendingUrls.set(key, pending)
  }
  throw pending
}

// Fire-and-forget url resolution for preloading outside of render (never suspends).
export const preloadAssetUrl = (loaders: UrlLoaders, key: string | undefined, onReady: (url: string) => void) => {
  if (!key || !loaders[key]) {
    return
  }
  const resolved = resolvedUrls.get(key)
  if (resolved !== undefined) {
    onReady(resolved)
    return
  }
  loaders[key]().then((url) => {
    resolvedUrls.set(key, url)
    onReady(url)
  })
}
