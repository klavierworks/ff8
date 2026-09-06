// Converted assets live outside `public`, so they are referenced through `import.meta.glob`.
// The glob is kept lazy (a map of `() => import('…?url')` thunks) so loading one field does
// not pull in every field's assets; this resolves a single thunk on demand, suspending via a
// thrown promise until the url is ready and caching it. Call only inside a Suspense boundary.

type UrlLoaders = Record<string, () => Promise<string>>

const MAX_LOAD_ATTEMPTS = 3

const resolvedUrls = new Map<string, string>()
const pendingUrls = new Map<string, Promise<unknown>>()
const failureCounts = new Map<string, number>()

const recordFailure = (key: string, error: unknown) => {
  const attempts = (failureCounts.get(key) ?? 0) + 1
  failureCounts.set(key, attempts)
  console.error(`Failed to load asset ${key} (attempt ${attempts} of ${MAX_LOAD_ATTEMPTS})`, error)
}

// The rejection is deliberately swallowed: the thrown promise must settle for Suspense to
// re-render, and that re-render is what drives the retry.
const startLoad = (loaders: UrlLoaders, key: string) => {
  const pending = loaders[key]()
    .then((url) => {
      resolvedUrls.set(key, url)
      failureCounts.delete(key)
    })
    .catch((error) => {
      recordFailure(key, error)
    })
    .finally(() => {
      pendingUrls.delete(key)
    })
  pendingUrls.set(key, pending)
  return pending
}

const getLoad = (loaders: UrlLoaders, key: string) => pendingUrls.get(key) ?? startLoad(loaders, key)

export const loadAssetUrl = (loaders: UrlLoaders, key: string | undefined): string => {
  if (!key || !loaders[key]) {
    throw new Error(`No bundled asset for ${key}`)
  }
  const resolved = resolvedUrls.get(key)
  if (resolved !== undefined) {
    return resolved
  }
  if ((failureCounts.get(key) ?? 0) >= MAX_LOAD_ATTEMPTS) {
    throw new Error(`Gave up loading asset ${key} after ${MAX_LOAD_ATTEMPTS} attempts`)
  }
  throw getLoad(loaders, key)
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
  getLoad(loaders, key).then(() => {
    const url = resolvedUrls.get(key)
    if (url !== undefined) {
      onReady(url)
    }
  })
}
