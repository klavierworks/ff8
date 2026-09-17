export const CHARAONE_LOADERS = import.meta.glob<string>('@data/worldmap/charaone/*.glb', {
  import: 'default',
  query: '?url',
})

export const buildCharaoneKey = (sectionIndex: number) =>
  `/extractor/data/converted/worldmap/charaone/world_${sectionIndex.toString().padStart(3, '0')}.glb`
