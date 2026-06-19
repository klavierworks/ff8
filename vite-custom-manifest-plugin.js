import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative, sep } from 'path';

const EXCLUDED_TOP_LEVEL_DIRS = new Set(['audio']);
const EXCLUDED_FILENAMES = new Set(['custom-manifest.json', '_sw.js', '_headers', '_redirects']);

export function customManifestPlugin() {
  return {
    name: 'custom-manifest',
    apply: 'build',

    async closeBundle() {
      try {
        const outputDir = join(process.cwd(), 'dist');

        console.log('Generating custom manifest...');

        const excludedAnimations = await collectAnimationOutputs(outputDir);
        const allFiles = await collectFilePaths(outputDir, outputDir);
        const filePaths = allFiles.filter((path) => !isExcluded(path, excludedAnimations));

        const manifestPath = join(outputDir, 'custom-manifest.json');
        await writeFile(manifestPath, JSON.stringify(filePaths, null, 2));

        const excludedCount = allFiles.length - filePaths.length;
        console.log(
          `Custom manifest created with ${filePaths.length} files ` +
            `(excluded ${excludedCount}: audio + ${excludedAnimations.size} animation GLBs + control files)`,
        );
      } catch (error) {
        console.error('Error generating custom manifest:', error);
      }
    },
  };
}

function isExcluded(relativePath, excludedAnimations) {
  const normalized = relativePath.split(sep).join('/');

  const topLevelDir = normalized.split('/')[0];
  if (EXCLUDED_TOP_LEVEL_DIRS.has(topLevelDir)) {
    return true;
  }

  const filename = normalized.split('/').pop();
  if (EXCLUDED_FILENAMES.has(filename)) {
    return true;
  }

  if (normalized.endsWith('.map')) {
    return true;
  }

  return excludedAnimations.has(normalized);
}

async function collectAnimationOutputs(outputDir) {
  const excluded = new Set();

  try {
    const viteManifestPath = join(outputDir, '.vite', 'manifest.json');
    const viteManifest = JSON.parse(await readFile(viteManifestPath, 'utf8'));

    for (const [source, entry] of Object.entries(viteManifest)) {
      if (source.includes('/animations/') && entry.file && entry.file.endsWith('.glb')) {
        excluded.add(entry.file);
      }
    }
  } catch (error) {
    console.warn('Could not read Vite manifest for animation exclusion:', error.message);
  }

  return excluded;
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
