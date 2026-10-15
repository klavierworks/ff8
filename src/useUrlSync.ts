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
  // URLSearchParams escapes commas, but they are valid in a query string and read back the same.
  url.search = url.searchParams.toString().replaceAll('%2C', ',')
  return url.toString()
}

const getProgress = () => MEMORY[256] ?? 0

const getParty = () => useGlobalStore.getState().party.join(',')

const pushFieldUrl = (fieldId: string) => {
  const url = buildUrl([...WORLDMAP_URL_PARAMS, 'module'], {
    field: fieldId,
    party: getParty(),
    progress: getProgress(),
  })
  window.history.pushState({}, '', url)
}

const replacePartyUrl = () => {
  const url = buildUrl([], { party: getParty() })
  if (url !== window.location.href) {
    window.history.replaceState({}, '', url)
  }
}

const replaceWorldmapUrl = () => {
  const params = buildWorldmapUrlParams()
  if (!params) {
    return
  }
  const url = buildUrl(['field', 'spawnPointId'], {
    ...params,
    module: 'worldmap',
    party: getParty(),
    progress: getProgress(),
  })
  if (url !== window.location.href) {
    window.history.replaceState({}, '', url)
  }
}

const useUrlSync = (isEnabled: boolean) => {
  const fieldId = useGlobalStore((state) => state.fieldId)
  const module = useGlobalStore((state) => state.module)
  const hasPendingField = useGlobalStore((state) => !!state.pendingFieldId)
  const party = useGlobalStore((state) => state.party)

  useEffect(() => {
    if (!isEnabled || module !== 'field' || !fieldId || hasPendingField) {
      return
    }
    pushFieldUrl(fieldId)
  }, [fieldId, hasPendingField, isEnabled, module])

  // Scripts change the party mid-field, so it is kept current without adding a history entry.
  useEffect(() => {
    if (!isEnabled || module === 'menu' || hasPendingField) {
      return
    }
    replacePartyUrl()
  }, [hasPendingField, isEnabled, module, party])

  useEffect(() => {
    if (!isEnabled || module !== 'worldmap') {
      return
    }
    window.history.pushState({}, '', buildUrl(['field'], { module: 'worldmap' }))
    const interval = window.setInterval(replaceWorldmapUrl, WORLDMAP_URL_UPDATE_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [isEnabled, module])
}

export default useUrlSync
