import { BufferAttribute, InterleavedBufferAttribute, Mesh } from 'three'

export const FLAGS_CANDIDATES = ['_flags', '_FLAGS', 'flags', 'FLAGS']

export const findFlagsAttribute = (mesh: Mesh): BufferAttribute | InterleavedBufferAttribute | undefined => {
  const attributes = mesh.geometry.attributes
  const match = FLAGS_CANDIDATES.find((candidate) => attributes[candidate])
  return match ? attributes[match] : undefined
}
