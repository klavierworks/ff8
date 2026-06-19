import { CACHE_NAME } from './CONSTANTS'

const CUSTOM_MANIFEST_PATH = '/custom-manifest.json'
const MAX_FETCH_ATTEMPTS = 3

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const isCacheableResponse = (response: Response) => {
  return response.status === 200 && response.type !== 'opaque'
}

const putInCache = async (request: Request, response: Response) => {
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response)
}

const networkFirst = async (request: Request) => {
  try {
    const response = await fetch(request)
    if (isCacheableResponse(response)) {
      void putInCache(request, response.clone()).catch(() => {})
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html')
      if (shell) {
        return shell
      }
    }
    throw error
  }
}

const cacheFirst = async (request: Request) => {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (isCacheableResponse(response)) {
    void putInCache(request, response.clone()).catch(() => {})
  }
  return response
}

export const handleFetch = async (request: Request) => {
  const url = new URL(request.url)

  if (!['http:', 'https:'].includes(url.protocol)) {
    return fetch(request)
  }

  if (request.method !== 'GET') {
    return fetch(request)
  }

  if (request.mode === 'navigate' || url.pathname === CUSTOM_MANIFEST_PATH) {
    return networkFirst(request)
  }

  return cacheFirst(request)
}

export const fetchFile = async (file: string, signal?: AbortSignal): Promise<Response> => {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const response = await fetch(file, { signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${file}`)
      }
      return response
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      if (attempt === MAX_FETCH_ATTEMPTS) {
        throw error
      }
      await sleep(1000 * attempt)
    }
  }

  throw new Error(`Failed to fetch ${file} after ${MAX_FETCH_ATTEMPTS} attempts`)
}
