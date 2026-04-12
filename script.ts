import { exits } from './src/gateways';
import WORLDMAP_GATEWAYS from './src/constants/worldmapGateways';

const WORLDMAP = WORLDMAP_GATEWAYS

interface WorldmapExit {
  worldmapId: string;
  exit: string;
}

interface WorldmapExitResults {
  matches: WorldmapExit[];
  unmatched: string[];
}

function findWorldmapExits(): WorldmapExitResults {
  const worldmapSet = new Set(WORLDMAP);
  const matches: WorldmapExit[] = [];
  const matchedIds = new Set<string>();

  for (const exit of exits) {
    console.log(`Checking exit: ${exit.id} targeting ${exit.target}`);
    if (worldmapSet.has(exit.target)) {
      matches.push({
        worldmapId: exit.target,
        exit: exit.source,
      });
      matchedIds.add(exit.target);
    }
  }

  // Sort matches by worldmapId
  matches.sort((a, b) => a.worldmapId.localeCompare(b.worldmapId));

  // Find unmatched worldmap IDs
  const unmatched = WORLDMAP.filter(id => !matchedIds.has(id));

  return {
    matches,
    unmatched,
  };
}

const results = findWorldmapExits();
console.log('Matches:', results.matches);
console.log('Unmatched:', results.unmatched);