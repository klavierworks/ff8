import { getAssetUrl, hasAsset, listAssets } from '../../assetManifest'
import { getGameData } from '../../gameData'

type FieldModels = Record<string, Record<string, { base: string }>>

const preloadedFieldIds = new Set<string>()

const isPreloadedMapFile = (path: string) => path.endsWith('/data.json') || path.endsWith('.png')

const getMapFilePaths = (fieldId: string) => listAssets(`field/mapdata/${fieldId}/`).filter(isPreloadedMapFile)

// Animation GLBs reach 8.5MB and are shared between fields, so only the per-field base meshes are listed.
const getBaseModelPaths = (fieldId: string) =>
  Object.entries((getGameData().fieldModels as FieldModels)[fieldId] ?? {})
    .map(([model, { base }]) => `field/models/base/${model}/${base}.glb`)
    .filter(hasAsset)

const getFieldAssetPaths = (fieldId: string) => {
  const mapFilePaths = getMapFilePaths(fieldId)
  if (mapFilePaths.length === 0) {
    return []
  }
  return [...mapFilePaths, ...getBaseModelPaths(fieldId)]
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

  await Promise.all(getFieldAssetPaths(fieldId).map((path) => warmCache(getAssetUrl(path))))
}
