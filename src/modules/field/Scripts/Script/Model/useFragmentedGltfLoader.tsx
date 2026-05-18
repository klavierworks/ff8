import { useGLTF } from '@react-three/drei'

import gltfIndex from './gltf_index.json'

const typedGltfIndex: GLTFIndex = gltfIndex as GLTFIndex
type GLTFIndex = {
  [fieldName: string]: {
    [baseGltf: string]: string
  }
}
export const useFragmentedGLTFLoader = (baseGltf: string, fieldName: string) => {
  const gltfFilename = typedGltfIndex[fieldName]?.[baseGltf]

  if (!gltfFilename) {
    console.warn(`GLTF file not found for baseGltf: ${baseGltf} in field: ${fieldName}. Using Squall`)
  }

  const [baseName, hashedName] = gltfFilename?.split('_') ?? ['d000', '0ec20e06.gltf']

  const result = useGLTF(`/models/optimized/${baseName}/${hashedName}`)

  return result
}

useFragmentedGLTFLoader.preload = () => null
