import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const optimizedDir = path.join(__dirname, '../public/models/optimized')
const indexFile = path.join(__dirname, '../public/models/gltf_index.json')
const outputDir = path.join(__dirname, '../public/models/combined')
const baseDir = path.join(outputDir, 'base')
const animsDir = path.join(outputDir, 'anims')
const loaderManifestFile = path.join(__dirname, '../src/modules/field/Scripts/Script/Model/manifest.json')

type Gltf = Record<string, any>

const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }

const align4 = (value: number) => Math.ceil(value / 4) * 4
const md5 = (buffer: Buffer) => createHash('md5').update(buffer).digest('hex')
const shortHash = (buffer: Buffer) => md5(buffer).slice(0, 12)

const cloneGltf = (gltf: Gltf): Gltf => JSON.parse(JSON.stringify(gltf))

// ─── GLB container ───

const GLB_MAGIC = 0x46546c67
const GLB_CHUNK_JSON = 0x4e4f534a
const GLB_CHUNK_BIN = 0x004e4942

const padBuffer = (buffer: Buffer, padByte: number) => {
  const remainder = buffer.length % 4
  return remainder === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(4 - remainder, padByte)])
}

const encodeGlb = (gltf: Gltf, bin: Buffer | null) => {
  const json = padBuffer(Buffer.from(JSON.stringify(gltf), 'utf-8'), 0x20)
  const hasBin = bin !== null && bin.length > 0
  const binChunk = hasBin ? padBuffer(bin, 0x00) : null
  const totalLength = 12 + 8 + json.length + (binChunk ? 8 + binChunk.length : 0)

  const header = Buffer.alloc(12)
  header.writeUInt32LE(GLB_MAGIC, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(json.length, 0)
  jsonHeader.writeUInt32LE(GLB_CHUNK_JSON, 4)

  const parts = [header, jsonHeader, json]
  if (binChunk) {
    const binHeader = Buffer.alloc(8)
    binHeader.writeUInt32LE(binChunk.length, 0)
    binHeader.writeUInt32LE(GLB_CHUNK_BIN, 4)
    parts.push(binHeader, binChunk)
  }
  return Buffer.concat(parts)
}

const writeGlb = async (filePath: string, gltf: Gltf, bin: Buffer | null) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, encodeGlb(gltf, bin))
}

const accessorElementBytes = (accessor: Gltf) =>
  accessor.count * COMPONENT_SIZE[accessor.componentType] * TYPE_COUNT[accessor.type]

const accessorData = (gltf: Gltf, bin: Buffer, accessorIndex: number): Buffer | null => {
  const accessor = gltf.accessors[accessorIndex]
  if (accessor.bufferView === undefined) {
    return null
  }
  const bufferView = gltf.bufferViews[accessor.bufferView]
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return bin.subarray(start, start + accessorElementBytes(accessor))
}

const accessorKey = (gltf: Gltf, bin: Buffer, accessorIndex: number) => {
  const accessor = gltf.accessors[accessorIndex]
  const data = accessorData(gltf, bin, accessorIndex)
  const shape = `${accessor.componentType}|${accessor.type}|${accessor.count}|${accessor.normalized ? 1 : 0}`
  return data ? `${md5(data)}|${shape}` : `implicit|${shape}|${JSON.stringify(accessor.min ?? null)}`
}

// ─── Geometry base (drop animations, keep Draco mesh + skeleton + texture) ───

const accessorBufferViews = (accessor: Gltf): number[] => {
  const views: number[] = []
  if (accessor.bufferView !== undefined) {
    views.push(accessor.bufferView)
  }
  if (accessor.sparse) {
    views.push(accessor.sparse.indices.bufferView)
    views.push(accessor.sparse.values.bufferView)
  }
  return views
}

const collectReferencedAccessors = (gltf: Gltf): Set<number> => {
  const referenced = new Set<number>()
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      for (const accessorIndex of Object.values(primitive.attributes ?? {})) {
        referenced.add(accessorIndex as number)
      }
      if (primitive.indices !== undefined) {
        referenced.add(primitive.indices)
      }
      for (const target of primitive.targets ?? []) {
        for (const accessorIndex of Object.values(target)) {
          referenced.add(accessorIndex as number)
        }
      }
    }
  }
  for (const skin of gltf.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) {
      referenced.add(skin.inverseBindMatrices)
    }
  }
  return referenced
}

const remapObjectValues = (object: Record<string, number>, map: Map<number, number>) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, map.get(value)]))

const repackGeometry = (gltf: Gltf, sourceBin: Buffer): Buffer => {
  const keptAccessors = [...collectReferencedAccessors(gltf)].sort((a, b) => a - b)
  const keptBufferViews = new Set<number>()
  for (const accessorIndex of keptAccessors) {
    for (const bufferView of accessorBufferViews(gltf.accessors[accessorIndex])) {
      keptBufferViews.add(bufferView)
    }
  }
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (draco) {
        keptBufferViews.add(draco.bufferView)
      }
    }
  }

  const orderedBufferViews = [...keptBufferViews].sort((a, b) => a - b)
  const bufferViewMap = new Map<number, number>()
  const chunks: Buffer[] = []
  const newBufferViews: Gltf[] = []
  let offset = 0
  orderedBufferViews.forEach((oldIndex, newIndex) => {
    const bufferView = gltf.bufferViews[oldIndex]
    const start = bufferView.byteOffset ?? 0
    chunks.push(sourceBin.subarray(start, start + bufferView.byteLength))
    const padding = align4(bufferView.byteLength) - bufferView.byteLength
    if (padding > 0) {
      chunks.push(Buffer.alloc(padding))
    }
    newBufferViews.push({ ...bufferView, buffer: 0, byteOffset: offset })
    bufferViewMap.set(oldIndex, newIndex)
    offset += align4(bufferView.byteLength)
  })

  const accessorMap = new Map<number, number>()
  const newAccessors = keptAccessors.map((oldIndex, newIndex) => {
    accessorMap.set(oldIndex, newIndex)
    const accessor = { ...gltf.accessors[oldIndex] }
    if (accessor.bufferView !== undefined) {
      accessor.bufferView = bufferViewMap.get(accessor.bufferView)
    }
    return accessor
  })

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      primitive.attributes = remapObjectValues(primitive.attributes, accessorMap)
      if (primitive.indices !== undefined) {
        primitive.indices = accessorMap.get(primitive.indices)
      }
      if (primitive.targets) {
        primitive.targets = primitive.targets.map((target: Record<string, number>) => remapObjectValues(target, accessorMap))
      }
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (draco) {
        draco.bufferView = bufferViewMap.get(draco.bufferView)
      }
    }
  }
  for (const skin of gltf.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) {
      skin.inverseBindMatrices = accessorMap.get(skin.inverseBindMatrices)
    }
  }

  gltf.accessors = newAccessors
  gltf.bufferViews = newBufferViews
  gltf.buffers = [{ uri: '', byteLength: Buffer.concat(chunks).length }]
  return Buffer.concat(chunks)
}

const embedImages = async (gltf: Gltf, geometryBin: Buffer, modelDir: string): Promise<Buffer> => {
  const parts = [geometryBin]
  let offset = geometryBin.length
  for (const image of gltf.images ?? []) {
    if (!image.uri) {
      continue
    }
    const data = await fs.readFile(path.join(modelDir, image.uri))
    image.bufferView = gltf.bufferViews.length
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length })
    delete image.uri
    parts.push(data)
    offset += data.length
    const padding = align4(offset) - offset
    if (padding > 0) {
      parts.push(Buffer.alloc(padding))
      offset += padding
    }
  }
  return Buffer.concat(parts)
}

const buildGeometry = async (sourceGltf: Gltf, sourceBin: Buffer, modelDir: string) => {
  const gltf = cloneGltf(sourceGltf)
  delete gltf.animations
  const geometryBin = repackGeometry(gltf, sourceBin)
  const bin = await embedImages(gltf, geometryBin, modelDir)
  const hash = shortHash(bin)
  gltf.buffers = [{ byteLength: bin.length }]
  return { gltf, bin, hash }
}

// ─── Clip library (accumulate every distinct animation for a model) ───

type ClipLibrary = ReturnType<typeof createClipLibrary>

const createClipLibrary = (canonicalSource: Gltf) => {
  const nodes = canonicalSource.nodes.map((node: Gltf) => {
    const copy = { ...node }
    delete copy.mesh
    delete copy.skin
    return copy
  })
  const nameToNode = new Map<string, number>(nodes.map((node: Gltf, index: number) => [node.name, index]))
  return {
    gltf: {
      asset: { version: '2.0', generator: 'combineModels clip-library' },
      scene: canonicalSource.scene,
      scenes: canonicalSource.scenes,
      nodes,
      accessors: [] as Gltf[],
      bufferViews: [] as Gltf[],
      animations: [] as Gltf[],
    } as Gltf,
    nameToNode,
    chunks: [] as Buffer[],
    offset: 0,
    accessorCache: new Map<string, number>(),
    clipIndexByHash: new Map<string, number>(),
    missingNodeNames: new Set<string>(),
  }
}

const addLibraryAccessor = (library: ClipLibrary, source: Gltf, sourceBin: Buffer, accessorIndex: number): number => {
  const key = accessorKey(source, sourceBin, accessorIndex)
  const cached = library.accessorCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  const sourceAccessor = source.accessors[accessorIndex]
  const accessor: Gltf = { componentType: sourceAccessor.componentType, count: sourceAccessor.count, type: sourceAccessor.type }
  if (sourceAccessor.normalized) {
    accessor.normalized = true
  }
  if (sourceAccessor.min) {
    accessor.min = sourceAccessor.min
  }
  if (sourceAccessor.max) {
    accessor.max = sourceAccessor.max
  }
  const data = accessorData(source, sourceBin, accessorIndex)
  if (data) {
    library.chunks.push(data)
    const padding = align4(data.length) - data.length
    if (padding > 0) {
      library.chunks.push(Buffer.alloc(padding))
    }
    accessor.bufferView = library.gltf.bufferViews.length
    library.gltf.bufferViews.push({ buffer: 0, byteOffset: library.offset, byteLength: data.length })
    library.offset += align4(data.length)
  }
  const index = library.gltf.accessors.length
  library.gltf.accessors.push(accessor)
  library.accessorCache.set(key, index)
  return index
}

const clipContentHash = (source: Gltf, sourceBin: Buffer, animation: Gltf) => {
  const channels = animation.channels.map((channel: Gltf) => {
    const sampler = animation.samplers[channel.sampler]
    const nodeName = source.nodes[channel.target.node]?.name ?? `#${channel.target.node}`
    return [
      nodeName,
      channel.target.path,
      sampler.interpolation,
      accessorKey(source, sourceBin, sampler.input),
      accessorKey(source, sourceBin, sampler.output),
    ].join('|')
  })
  channels.sort()
  return md5(Buffer.from(channels.join('\n')))
}

const addClip = (library: ClipLibrary, source: Gltf, sourceBin: Buffer, animation: Gltf): number => {
  const hash = clipContentHash(source, sourceBin, animation)
  const existing = library.clipIndexByHash.get(hash)
  if (existing !== undefined) {
    return existing
  }
  const samplers: Gltf[] = []
  const channels: Gltf[] = []
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler]
    const nodeName = source.nodes[channel.target.node].name
    const node = library.nameToNode.get(nodeName)
    if (node === undefined) {
      library.missingNodeNames.add(nodeName)
      continue
    }
    const samplerIndex = samplers.length
    samplers.push({
      input: addLibraryAccessor(library, source, sourceBin, sampler.input),
      output: addLibraryAccessor(library, source, sourceBin, sampler.output),
      interpolation: sampler.interpolation,
    })
    channels.push({ sampler: samplerIndex, target: { node, path: channel.target.path } })
  }
  const index = library.gltf.animations.length
  library.gltf.animations.push({ name: hash.slice(0, 12), channels, samplers })
  library.clipIndexByHash.set(hash, index)
  return index
}

// ─── Per-model processing ───

type CopyEntry = { base: string, clips: number[] }

const processModel = async (model: string) => {
  const modelDir = path.join(optimizedDir, model)
  const entries = await fs.readdir(modelDir)
  const gltfFiles = entries.filter(name => name.endsWith('.gltf')).sort()

  const copies: Record<string, CopyEntry> = {}
  const writtenBases = new Set<string>()
  let library: ClipLibrary | null = null

  for (const gltfFile of gltfFiles) {
    const copyHash = path.basename(gltfFile, '.gltf')
    const source: Gltf = JSON.parse(await fs.readFile(path.join(modelDir, gltfFile), 'utf-8'))
    const sourceBinName = source.buffers?.[0]?.uri
    const sourceBin = sourceBinName ? await fs.readFile(path.join(modelDir, sourceBinName)) : Buffer.alloc(0)

    const geometry = await buildGeometry(source, sourceBin, modelDir)
    if (!writtenBases.has(geometry.hash)) {
      writtenBases.add(geometry.hash)
      await writeGlb(path.join(baseDir, model, `${geometry.hash}.glb`), geometry.gltf, geometry.bin)
    }

    if (!library) {
      library = createClipLibrary(source)
    }
    const clips = (source.animations ?? []).map((animation: Gltf) => addClip(library as ClipLibrary, source, sourceBin, animation))
    copies[copyHash] = { base: geometry.hash, clips }
  }

  if (library) {
    const bin = Buffer.concat(library.chunks)
    library.gltf.buffers = bin.length > 0 ? [{ byteLength: bin.length }] : undefined
    await writeGlb(path.join(animsDir, `${model}.glb`), library.gltf, bin)
  }

  return {
    model,
    copies,
    baseCount: writtenBases.size,
    clipCount: library?.gltf.animations.length ?? 0,
    missingNodeNames: library ? [...library.missingNodeNames] : [],
  }
}

const buildManifest = async (copiesByModel: Record<string, Record<string, CopyEntry>>) => {
  const index: Record<string, Record<string, string>> = JSON.parse(await fs.readFile(indexFile, 'utf-8'))
  const manifest: Record<string, Record<string, CopyEntry>> = {}
  const unresolved: string[] = []

  for (const [field, models] of Object.entries(index)) {
    for (const [model, filename] of Object.entries(models)) {
      const underscore = filename.indexOf('_')
      const referencedModel = filename.slice(0, underscore)
      const copyHash = filename.slice(underscore + 1).replace('.gltf', '')
      const entry = copiesByModel[referencedModel]?.[copyHash]
      if (!entry) {
        unresolved.push(`${field}/${model} -> ${filename}`)
        continue
      }
      if (!manifest[field]) {
        manifest[field] = {}
      }
      manifest[field][model] = entry
    }
  }

  const serialized = JSON.stringify(manifest)
  await fs.writeFile(path.join(outputDir, 'manifest.json'), serialized, 'utf-8')
  await fs.writeFile(loaderManifestFile, serialized, 'utf-8')
  return unresolved
}

const directorySize = async (dir: string): Promise<number> => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const sizes = await Promise.all(
    entries.map(async entry => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return directorySize(full)
      }
      return (await fs.stat(full)).size
    }),
  )
  return sizes.reduce((total, size) => total + size, 0)
}

const formatMegabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)}MB`

const main = async () => {
  await fs.rm(outputDir, { recursive: true, force: true })

  const models = (await fs.readdir(optimizedDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  const copiesByModel: Record<string, Record<string, CopyEntry>> = {}
  let totalBases = 0
  let totalClips = 0
  const nodeWarnings: string[] = []

  for (const model of models) {
    const result = await processModel(model)
    copiesByModel[model] = result.copies
    totalBases += result.baseCount
    totalClips += result.clipCount
    if (result.missingNodeNames.length > 0) {
      nodeWarnings.push(`${model}: clip channels target node names absent from canonical skeleton (${result.missingNodeNames.join(', ')})`)
    }
  }

  const unresolved = await buildManifest(copiesByModel)

  const inputSize = await directorySize(optimizedDir)
  const outputSize = await directorySize(outputDir)

  console.log(`Combined ${models.length} models -> ${totalBases} geometry bases + ${totalClips} unique clips.`)
  console.log(`optimized/ total: ${formatMegabytes(inputSize)}`)
  console.log(`combined/  total: ${formatMegabytes(outputSize)}  (${(100 * (1 - outputSize / inputSize)).toFixed(1)}% smaller)`)

  if (unresolved.length > 0) {
    console.warn(`\n${unresolved.length} field references could not be resolved to a copy:`)
    for (const entry of unresolved.slice(0, 20)) {
      console.warn(`  ${entry}`)
    }
  }
  if (nodeWarnings.length > 0) {
    console.warn(`\n${nodeWarnings.length} models had clips targeting nodes outside the canonical skeleton:`)
    for (const warning of nodeWarnings.slice(0, 20)) {
      console.warn(`  ${warning}`)
    }
  }
}

main().catch(error => {
  console.error('Failed to combine models:', error)
  process.exit(1)
})
