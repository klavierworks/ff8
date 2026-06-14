import manifest from '@data/field/models/manifest.json'
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'

import { loadAssetUrl, preloadAssetUrl } from '../../../../../loadAssetUrl'

// Lazy globs: one thunk per model glb, resolved on demand so a field only pulls in its models.
const BASE_LOADERS = import.meta.glob<string>('/extractor/data/converted/field/models/base/**/*.glb', {
  import: 'default',
  query: '?url',
})
const ANIMATION_LOADERS = import.meta.glob<string>('/extractor/data/converted/field/models/animations/*.glb', {
  import: 'default',
  query: '?url',
})

const baseKey = (model: string, base: string) => `/extractor/data/converted/field/models/base/${model}/${base}.glb`
const animationKey = (model: string) => `/extractor/data/converted/field/models/animations/${model}.glb`

type CopyEntry = {
  base: string
  clips: number[]
}
type Manifest = {
  [fieldName: string]: {
    [model: string]: CopyEntry
  }
}

const typedManifest = manifest as Manifest
const DEFAULT_MODEL = 'd000'

const buildModelFallbacks = (): Record<string, CopyEntry> => {
  const fallbacks: Record<string, CopyEntry> = {}
  for (const models of Object.values(typedManifest)) {
    for (const [model, entry] of Object.entries(models)) {
      if (!fallbacks[model]) {
        fallbacks[model] = entry
      }
    }
  }
  return fallbacks
}

const modelFallbacks = buildModelFallbacks()

const resolveCopy = (model: string, fieldName: string) => {
  const entry = typedManifest[fieldName]?.[model] ?? modelFallbacks[model]
  if (entry) {
    return { entry, model }
  }
  console.warn(`No model data for ${model} in field ${fieldName}. Falling back to ${DEFAULT_MODEL}.`)
  return { entry: modelFallbacks[DEFAULT_MODEL], model: DEFAULT_MODEL }
}

export const useFragmentedGLTFLoader = (baseGltf: string, fieldName: string) => {
  const { entry, model } = resolveCopy(baseGltf, fieldName)
  const base = useGLTF(loadAssetUrl(BASE_LOADERS, baseKey(model, entry.base)))
  const library = useGLTF(loadAssetUrl(ANIMATION_LOADERS, animationKey(model)))

  const animations = useMemo(
    () => entry.clips.map((clipIndex) => library.animations[clipIndex]).filter(Boolean),
    [library, entry],
  )

  return { ...base, animations }
}

useFragmentedGLTFLoader.preload = (baseGltf?: string, fieldName?: string) => {
  if (!baseGltf) {
    return
  }
  const { entry, model } = resolveCopy(baseGltf, fieldName ?? '')
  preloadAssetUrl(BASE_LOADERS, baseKey(model, entry.base), useGLTF.preload)
  preloadAssetUrl(ANIMATION_LOADERS, animationKey(model), useGLTF.preload)
}
