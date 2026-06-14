import { BATCH_SIZE, CACHE_NAME } from './CONSTANTS'
import { fetchFile } from './fetch'
import { getState, updateState } from './state'

const CUSTOM_MANIFEST_URL = '/custom-manifest.json'

const loadManifest = async () => {
  const response = await fetch(CUSTOM_MANIFEST_URL)
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`)
  }

  const manifest = await response.json()

  if (!Array.isArray(manifest)) {
    throw new Error('Manifest must be a JSON array')
  }

  console.log(`Loaded ${manifest.length} files from custom manifest`)
  return manifest
}

const processBatches = async <T>(
  batchSize: number,
  items: T[],
  callback: (item: T, index: number, batch: T[]) => void,
  signal?: AbortSignal,
) => {
  const batches = Array.from({ length: Math.ceil(items.length / batchSize) }, (_, i) =>
    items.slice(i * batchSize, (i + 1) * batchSize),
  )

  for (const [batchIndex, batch] of batches.entries()) {
    if (signal?.aborted) {
      console.warn('Batch processing aborted')
      break
    }
    await Promise.all(batch.map((item, itemIndex) => callback(item, batchIndex * batchSize + itemIndex, batch)))
  }
}

const cacheFile = async (key: string, file: string) => {
  const cache = await caches.open(CACHE_NAME)
  if (await cache.match(key)) {
    return
  }
  const response = await fetchFile(file)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${file}`)
  }
  console.log(`Caching file: ${key} -> ${file}`)
  await cache.put(key, response)

  const { progress } = getState()

  await updateState({
    progress: {
      ...progress,
      current: progress.current + 1,
    },
  })
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let isInProgress = false
let abortController: AbortController | null = null
export const enableOfflineMode = async () => {
  if (isInProgress) {
    return
  }

  isInProgress = true
  await updateState({
    isEnablingOffline: true,
    isOfflineEnabled: false,
  })

  const manifest = await loadManifest()

  const currentState = getState()

  if (currentState.progress.total && currentState.progress.total !== manifest.length) {
    await disableOfflineMode()
  }

  const latestState = getState()
  await updateState({
    isEnablingOffline: true,
    isOfflineEnabled: false,
    progress: {
      ...latestState.progress,
      total: manifest.length,
    },
  })

  await pause(1000)

  abortController = new AbortController()
  await processBatches(
    BATCH_SIZE,
    manifest,
    async (file) => {
      await cacheFile(file, file)
    },
    abortController.signal,
  )

  if (!abortController || abortController.signal.aborted) {
    console.warn('Offline mode enabling was aborted')
    return
  }

  await updateState({
    isEnablingOffline: false,
    isOfflineEnabled: true,
  })
}

export const disableOfflineMode = async () => {
  isInProgress = false
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  await updateState({
    isEnablingOffline: false,
    isOfflineEnabled: false,
    progress: {
      current: 0,
      total: 0,
    },
  })

  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map((name) => caches.delete(name)))
}
