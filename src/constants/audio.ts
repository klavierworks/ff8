// ─── Audio: runtime ───

export const MAX_SFX_VOLUME = 128

export const SFX_PAN_CENTRE = 128

export const FULL_MUSIC_VOLUME = 127

export const PSX_VOLUME_MASK = 0x7f

export const MUSIC_BASE_VOLUME = 0.4

export const AKAO_MUSIC_BASE_VOLUME = 0.8

// ─── Audio: worldmap ───

export const WORLDMAP_MUSIC_ID = 41
export const RAGNAROK_MUSIC_ID = 89
export const CHOCOBO_MUSIC_ID = 81
export const RAGNAROK_MUSIC_START_MEASURE = 13
export const WORLDMAP_MUSIC_CHANNEL = 0
export const WORLDMAP_MUSIC_FADE_IN_FRAMES = 60

export const RAGNAROK_ENGINE_SOUND_ID = 500002
export const RAGNAROK_ENGINE_BASE_VOLUME = 80
export const RAGNAROK_ENGINE_SPEED_VOLUME_DIVISOR = 4
export const RAGNAROK_ENGINE_MAX_VOLUME = 127

export const WORLDMAP_SOUND_MAX_VOLUME = 127
export const CAR_ENGINE_SOUND_ID = 10058
export const LATE_CAR_ENGINE_SOUND_ID = 500001
export const LATE_CAR_VEHICLE_IDS: ReadonlySet<number> = new Set([39, 40])
export const GROUND_ENGINE_BASE_VOLUME = 60
export const GROUND_ENGINE_SPEED_SHIFT = 1
export const GARDEN_ENGINE_SOUND_ID = 500004
export const GARDEN_WATER_SOUND_ID = 500005
export const GARDEN_WATER_BASE_VOLUME = 64
export const GARDEN_WATER_ALTITUDE_SHIFT = 2
export const BOAT_SOUND_ID = 10059
export const BOAT_SOUND_DEPTH_SHIFT = 6
export const BOAT_SOUND_MIN_VOLUME = 90
export const BOAT_SOUND_MAX_VOLUME = 126

// ─── Audio: footsteps ───

export const FOOTSTEP_SOUNDS_MALE = { firstFoot: 3, secondFoot: 2 }
export const FOOTSTEP_SOUNDS_FEMALE = { firstFoot: 54, secondFoot: 53 }
export const FOOTSTEP_SOUNDS_LADDER = { firstFoot: 64, secondFoot: 63 }

export const FEMALE_FOOTSTEP_CHARACTER_IDS = [3, 4, 5, 7]

export const FOOTSTEP_PAN_MIN_SCREEN_X = -512
export const FOOTSTEP_PAN_MAX_SCREEN_X = 508
export const FOOTSTEP_PAN_SCREEN_X_DIVISOR = 4

export const FOOTSTEP_VOLUME_MAX = 127
export const FOOTSTEP_ATTENUATION_MIN = 8
export const FOOTSTEP_ATTENUATION_MAX = 110
export const FOOTSTEP_ATTENUATION_PER_WORLD_UNIT = 4096 / 96

export const MUSIC_IDS = {
  0: '/audio/Disc 1/11. The Loser.mp3',
  1: '/audio/Disc 1/05. The Winner.mp3',
  2: '/audio/901 The Landing (Demo).mp3',
  3: '/audio/003-combat.wav',
  4: '/audio/Disc 1/12. Never Look Back.mp3',
  5: "/audio/Disc 1/04. Don't Be Afraid.mp3",
  6: '/audio/006-funsui.wav',
  7: '/audio/Disc 1/13. Dead End.mp3',
  8: '/audio/Disc 1/09. Starting Up.mp3',
  9: '/audio/Disc 2/13. Intruders.mp3',
  10: '/audio/010-ante.wav',
  11: '/audio/011-wind.wav',
  12: '/audio/Disc 1/19. The Man With The Machine Gun.mp3',
  13: '/audio/Disc 1/10. Force Your Way.mp3',
  14: '/audio/Disc 1/01. Liberi Fatali.mp3',
  15: '/audio/Disc 2/08. Unrest.mp3',
  16: '/audio/Disc 2/10. The Stage Is Set.mp3',
  17: '/audio/Disc 1/08. The Landing.mp3',

  18: '/audio/Disc 3/13. Love Grows.mp3',
  19: '/audio/Disc 1/16. Waltz For The Moon.mp3',
  20: '/audio/Disc 2/19. Ami.mp3',
  21: '/audio/Disc 1/06. Find Your Way.mp3',

  22: '/audio/Disc 1/20. Julia.mp3',
  23: '/audio/Disc 2/12. Fithos Lusec Wecos Vinosec.mp3',
  24: '/audio/Disc 1/07. SeeD.mp3',
  25: '/audio/Disc 2/08. Unrest.mp3',
  26: '/audio/Disc 1/02. Balamb Garden.mp3',
  27: '/audio/Disc 1/18. Fear.mp3',
  28: '/audio/Disc 3/17. Dance With The Balamb-Fish.mp3',
  29: '/audio/Disc 2/04. Cactus Jack (Galbadian Anthem).mp3',
  30: '/audio/030-Flangchorus.wav',
  31: '/audio/031-dubchorus.wav',
  32: '/audio/032-Solochorus.wav',
  33: '/audio/033-Femalechorus.wav',
  34: '/audio/034-chorus.wav',
  35: '/audio/Disc 2/02. The Mission.mp3',
  36: '/audio/Disc 2/06. Succession Of Witches.mp3',
  37: '/audio/037-reet.wav',
  38: '/audio/038-soyo.wav',
  39: '/audio/039-rouka.wav',
  40: '/audio/040-night.wav',
  41: '/audio/Disc 1/03. Blue Fields.mp3',
  42: '/audio/Disc 1/14. Breezy.mp3',
  44: '/audio/044-sea.wav',
  46: '/audio/Disc 1/23. Timber Owls.mp3',
  47: '/audio/Disc 2/16. Fragments Of Memories.mp3',
  48: "/audio/Disc 3/07. Fisherman's Horizon.mp3",
  49: '/audio/Disc 3/06. Heresy.mp3',
  51: '/audio/Disc 2/01. My Mind.mp3',
  52: '/audio/Disc 3/09. Where I Belong.mp3',
  53: '/audio/053s-antena2.sgt',
  54: '/audio/Disc 4/03. Truth.mp3',
  55: '/audio/Disc 3/15. Trust Me.mp3',
  56: '/audio/Disc 2/07. Galbadia Garden.mp3',
  57: '/audio/Disc 2/03. Martial Law.mp3',
  58: '/audio/Disc 2/09. Under Her Control.mp3',
  59: '/audio/Disc 2/05. Only A Plank Between One And Perdition.mp3',
  60: '/audio/Disc 1/22. Junction.mp3',
  61: '/audio/Disc 1/21. Roses And Wine.mp3',
  62: '/audio/Disc 1/19. The Man With The Machine Gun.mp3',
  63: '/audio/Disc 2/11. A Sacrifice.mp3',
  64: '/audio/Disc 3/08. ODEKA ke Chocobo.mp3',
  65: '/audio/Disc 3/05. Drifting.mp3',
  66: '/audio/Disc 2/15. Wounded.mp3',
  67: '/audio/Disc 2/17. Jailed.mp3',
  68: '/audio/Disc 3/02. Retaliation.mp3',
  69: '/audio/Disc 3/10. The Oath.mp3',
  70: '/audio/Disc 1/15. Shuffle Or Boogie.mp3',
  71: '/audio/Disc 2/18. Rivals.mp3',
  72: '/audio/Disc 3/04. Blue Sky.mp3',
  73: '/audio/Disc 2/14. Premonition.mp3',
  74: '/audio/074-train.wav',
  75: '/audio/075s-Gar3.sgt',
  76: "/audio/Disc 4/08. Maybe I'm A Lion.mp3",
  77: '/audio/Disc 4/06. The Castle.mp3',
  78: "/audio/Disc 3/03. Movin'.mp3",
  79: '/audio/Disc 4/12. Overture.mp3',
  80: '/audio/Disc 3/01. The Spy.mp3',
  81: "/audio/Disc 4/01. Mods De Chocobo (Featuring N's Telecaster).mp3",
  82: '/audio/Disc 3/14. The Salt Flats.mp3',
  83: '/audio/Disc 3/19. Residents.mp3',
  84: '/audio/Disc 4/04. Lunatic Pandora.mp3',
  85: '/audio/Disc 3/16. Silence And Motion.mp3',
  86: '/audio/Disc 3/18. Tears Of The Moon.mp3',
  87: '/audio/087-mdmotor.wav',
  89: '/audio/Disc 4/02. Ride On.mp3',
  90: '/audio/Disc 4/07. The Legendary Beast.mp3',
  91: '/audio/Disc 3/11. Slide Show Part 1.mp3',
  92: '/audio/Disc 3/12. Slide Show Part 2.mp3',
  93: '/audio/Disc 4/09. The Extreme.mp3',
  94: '/audio/094-laswhite.wav',
  95: '/audio/095-lasbl.wav',
  96: '/audio/Disc 4/10. The Successor.mp3',
  97: '/audio/Disc 4/05. Compression Of Time.mp3',
  99: '/audio/099-joriku2.sgt',
  100: '/audio/043a-concert-tap.sgt',
  101: '/audio/043b-concert-flute.sgt',
  102: '/audio/043c-concert-fiddle.sgt',
  103: '/audio/043d-concert-aguitar.sgt',
  104: '/audio/043e-concert-sax.sgt',
  105: '/audio/043f-concert-piano.sgt',
  106: '/audio/043g-concert-eguitar.sgt',
  107: '/audio/043h-concert-ebass.sgt',
  200: '/audio/chocoworld.sgt',
} as const
