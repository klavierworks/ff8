// Worldmap vehicle ids. Mirror `world_currentVehicle` in the original engine —
// the values are the outer-tag namespace (per ida.md "sub_546F90 — inner→outer
// tag translation" at line ~597). Many systems index by these values:
// `sub_557A90` (movement integration), `sub_5447A0` (music selection),
// `sub_557250` (camera orbit), `sub_558D70` (camera transitions),
// `World_VehicleEngineSound` (per-vehicle engine SFX), and the entity-class
// visibility gate (`isVisibleInCurrentVehicle`).
export const VEHICLE_IDS = {
  // Galbadia airship / mobile Garden / "any vehicle" sentinels used by
  // CHECK_VEHICLE_TYPE script opcodes (per `opcodesReference.md`).
  ANY_VEHICLE: 129,
  // Balamb Garden in flight. `dword_C75D00 = 32`, vertical orbit `5216`,
  // music id 81 ("Movin'") per the original assignment.
  BALAMB_GARDEN: 48,
  // Cars / bikes. 32–40 share the "car class" mask `& 0x40` on walkmesh
  // byte 14; 132 is the alt special car. 33 specifically is the bike per the
  // ADD_ENTITY param table.
  BIKE: 33,
  // Boats — entries 64–66 in the section_9/10 entity spawn pipeline. Outer
  // tags 65/66 come from inner tags 77/78 via `sub_546F90`.
  BOAT_DEFAULT: 64,
  BOAT_FOLLOWING: 66,
  BOAT_INSIDE: 65,
  // Shumi train / jumbo cactuar — `& 0x10` walkmesh access bit, engine
  // sound from `WorldMapSound(0)` chocobo branch.
  CACTUAR: 49,
  CAR_CLASS_MAX: 40,
  CAR_CLASS_MIN: 32,
  CAR_SPECIAL: 132,
  GALBADIA_AIRCRAFT: 130,
  MOBILE_GARDEN: 131,
  // Default worldmap pedestrian — also covers values 0..9 as the "on-foot
  // class" per `sub_53E7A0`'s `< 0xA || == 128` check.
  ON_FOOT: 128,
  // Ragnarok. `dword_C75D00 = 120` (altitude-input gain), `dword_C75CFC =
  // 6144` (camera vertical orbit, +17.8% deeper than the default 5216),
  // music id 89 ("Ride On"), engine sound id 500002.
  RAGNAROK: 50,
} as const
