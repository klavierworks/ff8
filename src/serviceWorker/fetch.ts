import { CACHE_NAME } from './CONSTANTS'
import { getState } from './state'

export const handleFetch = async (request: Request) => {
  const url = new URL(request.url)

  if (!['http:', 'https:'].includes(url.protocol)) {
    return fetch(request)
  }

  const { isOfflineEnabled } = await getState()

  if (!isOfflineEnabled) {
    return fetch(request)
  }

  const cached = await caches.match(request)

  if (cached) {
    console.log(`Serving from cache: ${url.pathname}`)
    return cached
  }

  try {
    const response = await fetch(request)

    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    console.error(`Fetch failed for ${url.pathname}:`, error)

    if (request.destination === 'document') {
      const fallback = await caches.match('/')
      if (fallback) {
        console.log('Serving fallback page')
        return fallback
      }
    }

    throw new Error('Fetch failed and no cached version available')
  }
}

export const fetchFile = async (file: string, signal?: AbortSignal): Promise<Response> => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForOnline = (): Promise<void> => {
    return new Promise((resolve) => {
      if (navigator.onLine) {
        resolve()
        return
      }

      const handleOnline = () => {
        window.removeEventListener('online', handleOnline)
        resolve()
      }

      window.addEventListener('online', handleOnline)
    })
  }

  const attemptFetch = async (): Promise<Response> => {
    if (!navigator.onLine) {
      console.log('Network offline, waiting for connection...')
      await waitForOnline()
    }

    try {
      const response = await fetch(file, { signal })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }

      if (error instanceof TypeError || (error instanceof TypeError && error.message.includes('NetworkError'))) {
        console.log('Network error detected, waiting for connection...')
        await waitForOnline()
      }

      throw error
    }
  }

  while (true) {
    try {
      return await attemptFetch()
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }

      console.log(`Fetch failed for ${file}, retrying in 2 seconds...`, error)
      await sleep(2000)

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
    }
  }
}
