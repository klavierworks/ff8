import { useEffect } from 'react'

import { WORLDMAP_URL_UPDATE_INTERVAL_MS } from './constants/worldmapTransitions'
import { MEMORY } from './modules/field/Scripts/Script/handlers'
import { buildWorldmapUrlParams, WORLDMAP_URL_PARAMS } from './modules/worldmap/worldmapUrl'
import useGlobalStore from './store'

type UrlValues = Record<string, number | string>

const buildUrl = (removedKeys: readonly string[], values: UrlValues) => {
  const url = new URL(window.location.href)
  removedKeys.forEach((key) => url.searchParams.delete(key))
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value.toString()))
  return url.toString()
}

const getProgress = () => MEMORY[256] ?? 0

const pushFieldUrl = (fieldId: string) => {
  const url = buildUrl([...WORLDMAP_URL_PARAMS, 'module'], { field: fieldId, progress: getProgress() })
  window.history.pushState({}, '', url)
}

const replaceWorldmapUrl = () => {
  const params = buildWorldmapUrlParams()
  if (!params) {
    return
  }
  const url = buildUrl(['field', 'spawnPointId'], { ...params, module: 'worldmap', progress: getProgress() })
  if (url !== window.location.href) {
    window.history.replaceState({}, '', url)
  }
}

const useUrlSync = () => {
  const fieldId = useGlobalStore((state) => state.fieldId)
  const module = useGlobalStore((state) => state.module)
  const hasPendingField = useGlobalStore((state) => !!state.pendingFieldId)

  useEffect(() => {
    if (module !== 'field' || !fieldId || hasPendingField) {
      return
    }
    pushFieldUrl(fieldId)
  }, [fieldId, hasPendingField, module])

  useEffect(() => {
    if (module !== 'worldmap') {
      return
    }
    window.history.pushState({}, '', buildUrl(['field'], { module: 'worldmap' }))
    const interval = window.setInterval(replaceWorldmapUrl, WORLDMAP_URL_UPDATE_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [module])
}

export default useUrlSync
