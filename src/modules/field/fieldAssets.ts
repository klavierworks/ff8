import { loadAssetDirectory } from '../../assetManifest'

// A field's files and the shared field models are listed in their own manifests, which must be
// loaded before any of those assets are looked up.
export const loadFieldAssets = async (fieldId: string) => {
  await Promise.all([loadAssetDirectory('field/models/'), loadAssetDirectory(`field/mapdata/${fieldId}/`)])
}
