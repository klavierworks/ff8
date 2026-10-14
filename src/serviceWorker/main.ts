import { ASSET_MANIFEST_FILENAME, SITE_ASSET_BASE_URL } from '../constants/assets'
import { BATCH_SIZE, CACHE_NAME, OFFLINE_EXCLUDED_DATA_PREFIXES, OFFLINE_EXCLUDED_DATA_SEGMENT } from './CONSTANTS'
import { fetchFile } from './fetch'
import { getState, updateState } from './state'

const CUSTOM_MANIFEST_URL = '/custom-manifest.json'
const ASSET_MANIFEST_URL = `/${SITE_ASSET_BASE_URL}${ASSET_MANIFEST_FILENAME}`

type AssetManifest = {
  files: Record<string, string>
}

const loadBuildFiles = async (): Promise<string[]> => {
  const response = await fetch(CUSTOM_MANIFEST_URL, { cache: 'no-cache' })
  if (!response.ok) {
    console.warn(`Custom manifest unavailable (${response.status}); skipping precache`)
    return []
  }

  const manifest = await response.json()

  if (!Array.isArray(manifest)) {
    console.warn('Custom manifest is not a JSON array; skipping precache')
    return []
  }

  return manifest
}

const isOfflineDataPath = (path: string) =>
  !OFFLINE_EXCLUDED_DATA_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
  !path.includes(OFFLINE_EXCLUDED_DATA_SEGMENT)

// Cached under the same versioned urls the game requests, so a changed file is fetched afresh.
const loadDataFiles = async (): Promise<string[]> => {
  const response = await fetch(ASSET_MANIFEST_URL, { cache: 'no-cache' })
  if (!response.ok) {
    console.warn(`Asset manifest unavailable (${response.status}); skipping extracted files`)
    return []
  }

  const { files } = (await response.json()) as AssetManifest
  return Object.entries(files)
    .filter(([path]) => isOfflineDataPath(path))
    .map(([path, hash]) => `${SITE_ASSET_BASE_URL}${path}?v=${hash}`)
}

const loadManifest = async () => {
  const [buildFiles, dataFiles] = await Promise.all([loadBuildFiles(), loadDataFiles()])
  const manifest = [...buildFiles, ...dataFiles]
  console.log(`Loaded ${manifest.length} files for offline caching`)
  return manifest
}

const processBatches = async <T>(
  batchSize: number,
  items: T[],
  callback: (item: T, index: number, batch: T[]) => Promise<void>,
  signal: AbortSignal,
) => {
  const batches = Array.from({ length: Math.ceil(items.length / batchSize) }, (_, i) =>
    items.slice(i * batchSize, (i + 1) * batchSize),
  )

  for (const [batchIndex, batch] of batches.entries()) {
    if (signal.aborted) {
      console.warn('Batch processing aborted')
      return
    }
    await Promise.all(batch.map((item, itemIndex) => callback(item, batchIndex * batchSize + itemIndex, batch)))
  }
}

const incrementProgress = async () => {
  const { progress } = getState()
  await updateState({
    progress: {
      ...progress,
      current: progress.current + 1,
    },
  })
}

const cacheFile = async (file: string, signal: AbortSignal) => {
  const cache = await caches.open(CACHE_NAME)

  if (await cache.match(file)) {
    await incrementProgress()
    return
  }

  try {
    const response = await fetchFile(file, signal)
    await cache.put(file, response)
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
    console.warn(`Skipping ${file}:`, error)
  }

  await incrementProgress()
}

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

  if (manifest.length === 0) {
    isInProgress = false
    await updateState({
      isEnablingOffline: false,
      isOfflineEnabled: false,
    })
    return
  }

  const currentState = getState()
  if (currentState.progress.total && currentState.progress.total !== manifest.length) {
    await disableOfflineMode()
    isInProgress = true
  }

  await updateState({
    isEnablingOffline: true,
    isOfflineEnabled: false,
    progress: {
      current: 0,
      total: manifest.length,
    },
  })

  abortController = new AbortController()
  const { signal } = abortController

  await processBatches(BATCH_SIZE, manifest, (file) => cacheFile(file, signal), signal)

  if (signal.aborted) {
    console.warn('Offline mode enabling was aborted')
    return
  }

  isInProgress = false
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
