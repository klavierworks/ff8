import { readFile, writeFile } from 'node:fs/promises'

const ROOT_PACKAGE_URL = new URL('../package.json', import.meta.url)
const LIBRARY_PACKAGE_URL = new URL('../dist-lib/package.json', import.meta.url)
const PEER_PACKAGE_PATTERN = /^(react|react-dom|three|@react-three\/.+)$/

type Dependencies = Record<string, string>

const pickDependencies = (dependencies: Dependencies, shouldKeep: (name: string) => boolean) =>
  Object.fromEntries(Object.entries(dependencies).filter(([name]) => shouldKeep(name)))

const isPeerPackage = (name: string) => PEER_PACKAGE_PATTERN.test(name)

const toCaretRange = (version: string) => (version.startsWith('^') ? version : `^${version}`)

const buildPeerDependencies = (dependencies: Dependencies) =>
  Object.fromEntries(
    Object.entries(pickDependencies(dependencies, isPeerPackage)).map(([name, version]) => [
      name,
      toCaretRange(version),
    ]),
  )

const buildLibraryPackage = (rootPackage: { dependencies: Dependencies; name: string; version: string }) => ({
  dependencies: pickDependencies(rootPackage.dependencies, (name) => !isPeerPackage(name)),
  exports: {
    '.': {
      types: './library.d.ts',
      import: './ff8.js',
    },
  },
  name: rootPackage.name,
  peerDependencies: buildPeerDependencies(rootPackage.dependencies),
  type: 'module',
  types: './library.d.ts',
  version: rootPackage.version,
})

const rootPackage = JSON.parse(await readFile(ROOT_PACKAGE_URL, 'utf8'))
await writeFile(LIBRARY_PACKAGE_URL, `${JSON.stringify(buildLibraryPackage(rootPackage), null, 2)}\n`)
