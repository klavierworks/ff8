import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const optimizedDir = path.join(__dirname, '../public/models/optimized')
const outputDir = path.join(__dirname, '../public/models/separated')
const baseDir = path.join(outputDir, 'base')

type Gltf = Record<string, any>

const align4 = (value: number) => Math.ceil(value / 4) * 4

const isAssetFile = (name: string) => !name.endsWith('.gltf') && !name.endsWith('.bin')

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
  for (const animation of gltf.animations ?? []) {
    for (const sampler of animation.samplers) {
      referenced.add(sampler.input)
      referenced.add(sampler.output)
    }
  }
  return referenced
}

const remapObjectValues = (object: Record<string, number>, map: Map<number, number>) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, map.get(value)]))

const removeExtension = (gltf: Gltf, name: string) => {
  if (gltf.extensionsUsed) {
    gltf.extensionsUsed = gltf.extensionsUsed.filter((extension: string) => extension !== name)
  }
  if (gltf.extensionsRequired) {
    gltf.extensionsRequired = gltf.extensionsRequired.filter((extension: string) => extension !== name)
  }
}

const cloneGltf = (gltf: Gltf): Gltf => JSON.parse(JSON.stringify(gltf))

const repackBuffer = (gltf: Gltf, sourceBin: Buffer, bufferUri: string): Buffer => {
  const keptAccessors = [...collectReferencedAccessors(gltf)].sort((a, b) => a - b)

  const keptBufferViews = new Set<number>()
  for (const accessorIndex of keptAccessors) {
    for (const bufferView of accessorBufferViews(gltf.accessors[accessorIndex])) {
      keptBufferViews.add(bufferView)
    }
  }
  // Draco geometry lives in a bufferView referenced by the extension, not by an accessor.
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (draco) {
        keptBufferViews.add(draco.bufferView)
      }
    }
  }
  for (const image of gltf.images ?? []) {
    if (image.bufferView !== undefined) {
      keptBufferViews.add(image.bufferView)
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
    const padded = align4(bufferView.byteLength)
    if (padded > bufferView.byteLength) {
      chunks.push(Buffer.alloc(padded - bufferView.byteLength))
    }
    newBufferViews.push({ ...bufferView, buffer: 0, byteOffset: offset })
    bufferViewMap.set(oldIndex, newIndex)
    offset += padded
  })
  const newBin = Buffer.concat(chunks)

  const accessorMap = new Map<number, number>()
  const newAccessors = keptAccessors.map((oldIndex, newIndex) => {
    accessorMap.set(oldIndex, newIndex)
    const accessor = { ...gltf.accessors[oldIndex] }
    if (accessor.bufferView !== undefined) {
      accessor.bufferView = bufferViewMap.get(accessor.bufferView)
    }
    if (accessor.sparse) {
      accessor.sparse = {
        ...accessor.sparse,
        indices: { ...accessor.sparse.indices, bufferView: bufferViewMap.get(accessor.sparse.indices.bufferView) },
        values: { ...accessor.sparse.values, bufferView: bufferViewMap.get(accessor.sparse.values.bufferView) },
      }
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
        // draco.attributes are draco-local attribute ids, not glTF accessor indices — leave them.
        draco.bufferView = bufferViewMap.get(draco.bufferView)
      }
    }
  }
  for (const skin of gltf.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) {
      skin.inverseBindMatrices = accessorMap.get(skin.inverseBindMatrices)
    }
  }
  for (const animation of gltf.animations ?? []) {
    for (const sampler of animation.samplers) {
      sampler.input = accessorMap.get(sampler.input)
      sampler.output = accessorMap.get(sampler.output)
    }
  }
  for (const image of gltf.images ?? []) {
    if (image.bufferView !== undefined) {
      image.bufferView = bufferViewMap.get(image.bufferView)
    }
  }

  gltf.accessors = newAccessors
  gltf.bufferViews = newBufferViews
  if (newBin.length === 0) {
    delete gltf.buffers
  } else {
    gltf.buffers = [{ uri: bufferUri, byteLength: newBin.length }]
  }
  return newBin
}

const buildBase = (sourceGltf: Gltf, sourceBin: Buffer, model: string) => {
  const gltf = cloneGltf(sourceGltf)
  delete gltf.animations
  const bin = repackBuffer(gltf, sourceBin, `${model}.bin`)
  return { gltf, bin }
}

const buildAnimations = (sourceGltf: Gltf, sourceBin: Buffer, model: string, hash: string) => {
  const gltf = cloneGltf(sourceGltf)
  delete gltf.meshes
  delete gltf.skins
  delete gltf.materials
  delete gltf.textures
  delete gltf.images
  delete gltf.samplers
  for (const node of gltf.nodes ?? []) {
    delete node.mesh
    delete node.skin
  }
  removeExtension(gltf, 'KHR_draco_mesh_compression')
  removeExtension(gltf, 'EXT_texture_webp')
  const bin = repackBuffer(gltf, sourceBin, `${model}_${hash}.bin`)
  return { gltf, bin }
}

const hashBuffer = (buffer: Buffer) => createHash('md5').update(buffer).digest('hex')

const writeGltf = async (filePath: string, gltf: Gltf, bin: Buffer | null, binName: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(gltf), 'utf-8')
  if (bin && bin.length > 0) {
    await fs.writeFile(path.join(path.dirname(filePath), binName), bin)
  }
}

const processModel = async (model: string) => {
  const modelDir = path.join(optimizedDir, model)
  const entries = await fs.readdir(modelDir)
  const gltfFiles = entries.filter(name => name.endsWith('.gltf')).sort()
  const assetFiles = entries.filter(isAssetFile)

  let baseHash: string | null = null
  const divergentCopies: string[] = []
  let inputBytes = 0
  let animationBytes = 0

  for (const gltfFile of gltfFiles) {
    const hash = path.basename(gltfFile, '.gltf')
    const sourceGltf: Gltf = JSON.parse(await fs.readFile(path.join(modelDir, gltfFile), 'utf-8'))
    const sourceBinName = sourceGltf.buffers?.[0]?.uri
    const sourceBin = sourceBinName ? await fs.readFile(path.join(modelDir, sourceBinName)) : Buffer.alloc(0)
    inputBytes += sourceBin.length

    const base = buildBase(sourceGltf, sourceBin, model)
    const currentBaseHash = hashBuffer(base.bin)

    if (baseHash === null) {
      baseHash = currentBaseHash
      const baseModelDir = path.join(baseDir, model)
      await writeGltf(path.join(baseModelDir, `${model}.gltf`), base.gltf, base.bin, `${model}.bin`)
      await Promise.all(
        assetFiles.map(asset => fs.copyFile(path.join(modelDir, asset), path.join(baseModelDir, asset))),
      )
    } else if (currentBaseHash !== baseHash) {
      divergentCopies.push(hash)
    }

    const animations = buildAnimations(sourceGltf, sourceBin, model, hash)
    animationBytes += animations.bin.length
    await writeGltf(path.join(outputDir, model, gltfFile), animations.gltf, animations.bin, `${model}_${hash}.bin`)
  }

  return { model, copies: gltfFiles.length, inputBytes, animationBytes, divergentCopies }
}

const formatMegabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)}MB`

const main = async () => {
  await fs.rm(outputDir, { recursive: true, force: true })

  const models = (await fs.readdir(optimizedDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  let totalInput = 0
  let totalAnimation = 0
  let totalCopies = 0
  const warnings: string[] = []

  for (const model of models) {
    const result = await processModel(model)
    totalInput += result.inputBytes
    totalAnimation += result.animationBytes
    totalCopies += result.copies
    if (result.divergentCopies.length > 0) {
      warnings.push(`${model}: ${result.divergentCopies.length} copies have geometry differing from the base (${result.divergentCopies.join(', ')})`)
    }
  }

  console.log(`Separated ${totalCopies} copies across ${models.length} models.`)
  console.log(`Input .bin total:        ${formatMegabytes(totalInput)}`)
  console.log(`Animation .bin total:    ${formatMegabytes(totalAnimation)}`)
  console.log(`Geometry duplication removed (approx): ${formatMegabytes(totalInput - totalAnimation)}`)

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} models have copies whose geometry differs from their base — these need their own base:`)
    for (const warning of warnings) {
      console.warn(`  ${warning}`)
    }
  }
}

main().catch(error => {
  console.error('Failed to separate models:', error)
  process.exit(1)
})
