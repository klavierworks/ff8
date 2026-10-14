import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONVERTED_DIR = fileURLToPath(new URL('../extractor/data/converted', import.meta.url))
const MANIFEST_FILENAME = 'asset-manifest.json'
const EXCLUDED_TOP_LEVEL_DIRS = new Set(['types'])
const HASH_LENGTH = 10
const CONCURRENT_HASHES = 32

const toManifestPath = (file: string) => relative(CONVERTED_DIR, file).split(sep).join('/')

const isIncluded = (manifestPath: string) =>
  manifestPath !== MANIFEST_FILENAME && !EXCLUDED_TOP_LEVEL_DIRS.has(manifestPath.split('/')[0])

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  )
  return nested.flat()
}

const hashFile = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex').slice(0, HASH_LENGTH)))
  })

const hashInBatches = async (files: string[]) => {
  const hashes: string[] = []
  for (let start = 0; start < files.length; start += CONCURRENT_HASHES) {
    hashes.push(...(await Promise.all(files.slice(start, start + CONCURRENT_HASHES).map(hashFile))))
  }
  return hashes
}

const buildAssetManifest = async () => {
  const files = (await listFiles(CONVERTED_DIR)).filter((file) => isIncluded(toManifestPath(file))).sort()
  const hashes = await hashInBatches(files)
  const manifest = { files: Object.fromEntries(files.map((file, index) => [toManifestPath(file), hashes[index]])) }
  await writeFile(join(CONVERTED_DIR, MANIFEST_FILENAME), JSON.stringify(manifest))
  console.log(`Asset manifest written for ${files.length} files`)
}

await buildAssetManifest()
