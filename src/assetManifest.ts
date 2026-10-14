import { ASSET_MANIFEST_FILENAME } from './constants/assets'

type AssetManifest = {
  files: Record<string, string>
}

let assetBaseUrl = ''
let fileHashes: Record<string, string> = {}

const withTrailingSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`)

export const loadAssetManifest = async (baseUrl: string) => {
  const base = withTrailingSlash(baseUrl)
  const response = await fetch(`${base}${ASSET_MANIFEST_FILENAME}`, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Asset manifest unavailable at ${base}: ${response.status}`)
  }
  const manifest = (await response.json()) as AssetManifest
  assetBaseUrl = base
  fileHashes = manifest.files
}

export const hasAsset = (path: string) => path in fileHashes

export const listAssets = (prefix: string) => Object.keys(fileHashes).filter((path) => path.startsWith(prefix))

export const getAssetUrl = (path: string) => {
  const hash = fileHashes[path]
  if (!hash) {
    throw new Error(`No extracted file at ${path}`)
  }
  return `${assetBaseUrl}${path}?v=${hash}`
}

export const fetchAssetJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(getAssetUrl(path))
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`)
  }
  return response.json() as Promise<T>
}
