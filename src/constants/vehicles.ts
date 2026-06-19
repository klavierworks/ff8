// Worldmap vehicle ids. Mirror `world_currentVehicle` in the original engine — the values are
// the outer-tag namespace (see ida.md "inner→outer tag translation"). Many systems index by
// these values: movement integration, music selection, camera orbit/transitions, per-vehicle
// engine sound, and the entity-class visibility gate.
export const VEHICLE_IDS = {
  // Galbadia airship / mobile Garden / "any vehicle" sentinels used by
  // CHECK_VEHICLE_TYPE script opcodes (per `opcodesReference.md`).
  ANY_VEHICLE: 129,
  // Balamb Garden in flight. Altitude-input gain 32, camera vertical orbit 5216,
  // music id 81 ("Movin'") per the original assignment.
  BALAMB_GARDEN: 48,
  // Cars / bikes. 32–40 share the "car class" mask `& 0x40` on walkmesh
  // byte 14; 132 is the alt special car. 33 specifically is the bike per the
  // ADD_ENTITY param table.
  BIKE: 33,
  // Boats — entries 64–66 in the section_9/10 entity spawn pipeline. Outer
  // tags 65/66 come from inner tags 77/78 via the inner→outer translation.
  BOAT_DEFAULT: 64,
  BOAT_FOLLOWING: 66,
  BOAT_INSIDE: 65,
  // Shumi train / jumbo cactuar — `& 0x10` walkmesh access bit, engine
  // sound from the chocobo branch of the worldmap sound selector.
  CACTUAR: 49,
  CAR_CLASS_MAX: 40,
  CAR_CLASS_MIN: 32,
  CAR_SPECIAL: 132,
  GALBADIA_AIRCRAFT: 130,
  MOBILE_GARDEN: 131,
  // Default worldmap pedestrian — also covers values 0..9 as the "on-foot
  // class" per the engine's `< 0xA || == 128` check.
  ON_FOOT: 128,
  // Ragnarok. Altitude-input gain 120, camera vertical orbit 6144 (+17.8% deeper
  // than the default 5216), music id 89 ("Ride On"), engine sound id 500002.
  RAGNAROK: 50,
} as const
