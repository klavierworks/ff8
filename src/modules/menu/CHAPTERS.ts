type Chapter = {
  fieldId: string
  party?: number[]
  progress: number
}

export const CHAPTERS: Record<string, Chapter> = {
  '1st Laguna dream': {
    fieldId: 'testbl6',
    party: [8, 9, 10],
    progress: 22,
  },
  'Disk Four': {
    fieldId: 'testbl6',
    progress: 900,
  },
  'Disk Three': {
    fieldId: 'testbl6',
    progress: 900,
  },
  'Disk Two': {
    fieldId: 'testbl6',
    progress: 392,
  },
  'Esthar: arrival': {
    fieldId: 'ectake1',
    progress: 1900,
  },
  "Fisherman's H": {
    fieldId: 'fhdeck1',
    progress: 610,
  },
  Intro: {
    fieldId: 'start0',
    party: [0],
    progress: 0,
  },
  'Lunatic Pandora': {
    fieldId: 'rgcock2',
    progress: 3850,
  },
  'Shumi Village': {
    fieldId: 'tmdome1',
    progress: 2000,
  },
  'The Castle': {
    fieldId: 'ffbrdg1',
    progress: 4020,
  },
}
