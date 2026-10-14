import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONVERTED_DIR = fileURLToPath(new URL('../extractor/data/converted', import.meta.url))
const MANIFEST_FILENAME = 'asset-manifest.json'
const OFFLINE_MANIFEST_FILENAME = 'offline-manifest.json'
const EXCLUDED_TOP_LEVEL_DIRS = new Set(['types'])
const HASH_LENGTH = 10
const CONCURRENT_HASHES = 32

// Each field's folder and the field model GLBs get their own manifest, fetched when a field
// loads, so the manifest read at startup only lists what is needed before then.
const FIELD_DIRECTORY_PATTERN = /^field\/mapdata\/[^/]+\//
const FIELD_MODEL_DIRECTORY = 'field/models/'
const FIELD_MODEL_FILE_PATTERN = /^field\/models\/(base|animations)\//

type Hashes = Record<string, string>

const toManifestPath = (file: string) => relative(CONVERTED_DIR, file).split(sep).join('/')

const isIncluded = (manifestPath: string) => {
  const filename = manifestPath.split('/').pop()
  return (
    filename !== MANIFEST_FILENAME &&
    filename !== OFFLINE_MANIFEST_FILENAME &&
    !EXCLUDED_TOP_LEVEL_DIRS.has(manifestPath.split('/')[0])
  )
}

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

const getGroupDirectory = (path: string) => {
  if (FIELD_MODEL_FILE_PATTERN.test(path)) {
    return FIELD_MODEL_DIRECTORY
  }
  return path.match(FIELD_DIRECTORY_PATTERN)?.[0]
}

// Written manifests are listed in the startup manifest under their own hash, so they are
// requested with a versioned url like every other asset.
const writeManifest = async (path: string, files: Hashes) => {
  const contents = JSON.stringify({ files })
  await writeFile(join(CONVERTED_DIR, path), contents)
  return createHash('sha256').update(contents).digest('hex').slice(0, HASH_LENGTH)
}

const buildAssetManifest = async () => {
  const files = (await listFiles(CONVERTED_DIR)).filter((file) => isIncluded(toManifestPath(file))).sort()
  const hashes = await hashInBatches(files)

  const startupFiles: Hashes = {}
  const groups: Record<string, Hashes> = {}
  files.forEach((file, index) => {
    const path = toManifestPath(file)
    const directory = getGroupDirectory(path)
    if (directory) {
      groups[directory] ??= {}
      groups[directory][path] = hashes[index]
    } else {
      startupFiles[path] = hashes[index]
    }
  })

  for (const [directory, groupFiles] of Object.entries(groups)) {
    const path = `${directory}${MANIFEST_FILENAME}`
    startupFiles[path] = await writeManifest(path, groupFiles)
  }

  const sortedStartupFiles = Object.fromEntries(Object.entries(startupFiles).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(join(CONVERTED_DIR, MANIFEST_FILENAME), JSON.stringify({ files: sortedStartupFiles }))

  // The service worker caches every file for offline play, so it reads one list of everything.
  const allFiles = Object.assign({}, sortedStartupFiles, ...Object.values(groups))
  await writeFile(join(CONVERTED_DIR, OFFLINE_MANIFEST_FILENAME), JSON.stringify({ files: allFiles }))

  console.log(
    `Asset manifest written for ${Object.keys(sortedStartupFiles).length} files, ` +
      `with ${Object.keys(groups).length} directory manifests covering ${files.length} files in total`,
  )
}

await buildAssetManifest()
