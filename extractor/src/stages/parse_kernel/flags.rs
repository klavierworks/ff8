// Bit/enum tables shared across kernel data sections. Names follow the FF8 modding
// wiki / Doomtrain conventions. Empty strings mark documented-unused bits.

pub const ELEMENTS: [&str; 8] = [
    "Fire", "Ice", "Thunder", "Earth", "Poison", "Wind", "Water", "Holy",
];

// Status group 1 (u16): the low byte is the canonical "statuses 0" set; the two
// HP-threshold bits live in the high byte.
pub const STATUS1: [&str; 16] = [
    "Death", "Poison", "Petrify", "Darkness", "Silence", "Berserk", "Zombie", "", "HP<25%",
    "HP<50%", "", "", "", "", "", "",
];

// Status group 2 (u32): the canonical "statuses 1" set.
pub const STATUS2: [&str; 32] = [
    "Sleep",
    "Haste",
    "Slow",
    "Stop",
    "Regen",
    "Protect",
    "Shell",
    "Reflect",
    "Aura",
    "Curse",
    "Doom",
    "Invincible",
    "Petrifying",
    "Float",
    "Confusion",
    "Drain",
    "Eject",
    "Double",
    "Triple",
    "Defend",
    "Immune Physical",
    "Immune Magic",
    "Charged",
    "Back Attack",
    "Vit0",
    "Angel Wing",
    "",
    "",
    "",
    "",
    "Has Magic",
    "Invocation Pending",
];

pub const TARGET_INFO: [&str; 8] = [
    "Dead",
    "",
    "",
    "Single Side",
    "Single",
    "Everyone One Side",
    "Enemy",
    "",
];

pub const GF_NAMES: [&str; 16] = [
    "Quezacotl",
    "Shiva",
    "Ifrit",
    "Siren",
    "Brothers",
    "Diablos",
    "Carbuncle",
    "Leviathan",
    "Pandemona",
    "Cerberus",
    "Alexander",
    "Doomtrain",
    "Bahamut",
    "Cactuar",
    "Tonberry",
    "Eden",
];

pub fn decode_bits(value: u32, names: &[&str]) -> Vec<String> {
    names
        .iter()
        .enumerate()
        .filter(|(bit, name)| !name.is_empty() && value & (1 << bit) != 0)
        .map(|(_, name)| (*name).to_string())
        .collect()
}
