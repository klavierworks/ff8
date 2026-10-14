import { readdir, writeFile } from 'fs/promises';
import { join, relative, resolve, sep } from 'path';

const EXCLUDED_FILENAMES = new Set(['custom-manifest.json', '_sw.js', '_headers', '_redirects']);

// Lists the build's own files for offline caching. Extractor files are not in the build; the
// service worker adds them from the host's asset manifest.
export function customManifestPlugin() {
  let outputDir;

  return {
    name: 'custom-manifest',
    apply: 'build',

    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },

    async closeBundle() {
      try {
        console.log('Generating custom manifest...');

        const allFiles = await collectFilePaths(outputDir, outputDir);
        const filePaths = allFiles.filter((path) => !isExcluded(path));

        await writeFile(join(outputDir, 'custom-manifest.json'), JSON.stringify(filePaths, null, 2));

        console.log(`Custom manifest created with ${filePaths.length} files`);
      } catch (error) {
        console.error('Error generating custom manifest:', error);
      }
    },
  };
}

function isExcluded(relativePath) {
  const normalized = relativePath.split(sep).join('/');
  const filename = normalized.split('/').pop();
  return EXCLUDED_FILENAMES.has(filename) || normalized.endsWith('.map');
}

async function collectFilePaths(dir, baseDir) {
  const filePaths = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subPaths = await collectFilePaths(fullPath, baseDir);
        filePaths.push(...subPaths);
      } else {
        const relativePath = relative(baseDir, fullPath);
        filePaths.push(relativePath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message);
  }

  return filePaths.sort();
}
