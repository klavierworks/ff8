import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MAPDATA_PREFIX = 'extractor/data/converted/field/mapdata/';
const MODEL_BASE_PREFIX = 'extractor/data/converted/field/models/base/';
const MODEL_MANIFEST_PATH = 'extractor/data/converted/field/models/manifest.json';

export function fieldAssetsPlugin() {
  return {
    name: 'field-assets',
    apply: 'build',

    async closeBundle() {
      try {
        const outputDir = join(process.cwd(), 'dist');

        console.log('Generating field asset lookup...');

        const viteManifest = JSON.parse(await readFile(join(outputDir, '.vite', 'manifest.json'), 'utf8'));
        const modelManifest = JSON.parse(await readFile(join(process.cwd(), MODEL_MANIFEST_PATH), 'utf8'));

        const fieldAssets = collectFieldAssets(viteManifest, modelManifest);

        await writeFile(join(outputDir, 'field-assets.json'), JSON.stringify(fieldAssets));

        console.log(`Field asset lookup created for ${Object.keys(fieldAssets).length} fields`);
      } catch (error) {
        console.error('Error generating field asset lookup:', error);
      }
    },
  };
}

function collectMapdataAssets(viteManifest) {
  const fieldAssets = {};

  for (const [source, entry] of Object.entries(viteManifest)) {
    if (!source.startsWith(MAPDATA_PREFIX) || source.includes('?')) {
      continue;
    }

    const [fieldId, filename] = source.slice(MAPDATA_PREFIX.length).split('/');
    if (!filename || (filename !== 'data.json' && !filename.endsWith('.png'))) {
      continue;
    }

    fieldAssets[fieldId] = [...(fieldAssets[fieldId] ?? []), entry.file];
  }

  return fieldAssets;
}

// Animation GLBs reach 8.5MB and are shared between fields, so only the per-field base meshes are listed.
function collectBaseModels(viteManifest, models) {
  return Object.entries(models)
    .map(([model, { base }]) => viteManifest[`${MODEL_BASE_PREFIX}${model}/${base}.glb`])
    .filter(Boolean)
    .map((entry) => entry.file);
}

function collectFieldAssets(viteManifest, modelManifest) {
  const fieldAssets = collectMapdataAssets(viteManifest);

  for (const [fieldId, models] of Object.entries(modelManifest)) {
    if (!fieldAssets[fieldId]) {
      continue;
    }
    fieldAssets[fieldId] = [...fieldAssets[fieldId], ...collectBaseModels(viteManifest, models)];
  }

  return fieldAssets;
}
