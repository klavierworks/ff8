type FieldAssets = Record<string, string[]>

const FIELD_ASSETS_URL = '/field-assets.json'

const preloadedFieldIds = new Set<string>()

let fieldAssets: Promise<FieldAssets> | undefined

// Only the production build emits the lookup, so a miss means preloading is unavailable, not broken.
const getFieldAssets = () => {
  if (!fieldAssets) {
    fieldAssets = fetch(FIELD_ASSETS_URL)
      .then((response) => (response.ok ? (response.json() as Promise<FieldAssets>) : {}))
      .catch(() => ({}))
  }
  return fieldAssets
}

const warmCache = async (url: string) => {
  try {
    const response = await fetch(url, { priority: 'low' })
    await response.arrayBuffer()
  } catch (error) {
    console.warn(`Failed to prefetch ${url}`, error)
  }
}

export const preloadField = async (fieldId: string | undefined) => {
  if (!fieldId) {
    return
  }

  if (preloadedFieldIds.has(fieldId)) {
    console.log(`Field ${fieldId} already preloaded`)
    return
  }

  console.log(`Preloading field ${fieldId}...`)

  preloadedFieldIds.add(fieldId)

  const urls = (await getFieldAssets())[fieldId]
  if (!urls) {
    return
  }

  await Promise.all(urls.map((url) => warmCache(`/${url}`)))
}
