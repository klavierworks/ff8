use super::flags::{decode_bits, ELEMENTS, GF_NAMES, STATUS1, STATUS2, TARGET_INFO};
use super::kernel::section_range;
use super::reader::Reader;
use crate::utils::ff8_text::TextCodec;
use serde_json::{json, Value};

const CHARACTER_NAMES: [&str; 11] = [
    "Squall", "Zell", "Irvine", "Quistis", "Rinoa", "Selphie", "Seifer", "Edea", "Laguna", "Kiros",
    "Ward",
];
const RENZOKUKEN_FINISHERS: [&str; 4] = [
    "Rough Divide",
    "Fated Circle",
    "Blasting Zone",
    "Lion Heart",
];
const DEVOUR_STATS: [&str; 6] = ["STR", "VIT", "MAG", "SPR", "SPD", "LUCK"];
const SEQUENCE_BUTTONS: [(u16, &str); 13] = [
    (0x0001, "Finisher"),
    (0x0010, "Up"),
    (0x0020, "Right"),
    (0x0040, "Down"),
    (0x0080, "Left"),
    (0x0100, "L2"),
    (0x0200, "R2"),
    (0x0400, "L1"),
    (0x0800, "R1"),
    (0x1000, "Triangle"),
    (0x2000, "Circle"),
    (0x4000, "X"),
    (0x8000, "Square"),
];

pub struct Text<'a> {
    kernel: &'a [u8],
    pointers: &'a [usize],
    codec: &'a TextCodec,
}

impl<'a> Text<'a> {
    pub fn new(kernel: &'a [u8], pointers: &'a [usize], codec: &'a TextCodec) -> Self {
        Self {
            kernel,
            pointers,
            codec,
        }
    }

    fn resolve(&self, section: usize, offset: u16) -> Option<String> {
        if offset == 0xFFFF {
            return None;
        }
        let (start, end) = section_range(self.pointers, section, self.kernel.len());
        let blob = self.kernel.get(start..end)?;
        let position = offset as usize;
        if position >= blob.len() {
            return None;
        }
        Some(self.codec.decode_string(blob, position).0)
    }
}

fn name(text: &Text, section: Option<usize>, offset: u16) -> Value {
    match section.and_then(|index| text.resolve(index, offset)) {
        Some(string) => Value::String(string),
        None => Value::Null,
    }
}

fn elements(value: u8) -> Value {
    json!(decode_bits(value as u32, &ELEMENTS))
}

fn statuses(status1: u16, status2: u32) -> Value {
    let mut names = decode_bits(status1 as u32, &STATUS1);
    names.extend(decode_bits(status2, &STATUS2));
    json!(names)
}

fn target(value: u8) -> Value {
    json!(decode_bits(value as u32, &TARGET_INFO))
}

fn gf_compatibility(reader: &Reader, offset: usize) -> Value {
    let entries: Vec<Value> = GF_NAMES
        .iter()
        .enumerate()
        .map(|(index, gf)| json!({ "gf": gf, "value": reader.u8(offset + index) }))
        .collect();
    Value::Array(entries)
}

fn array<F>(bytes: &[u8], record_size: usize, parse: F) -> Value
where
    F: Fn(&Reader) -> Value,
{
    Value::Array(
        bytes
            .chunks_exact(record_size)
            .map(|record| parse(&Reader::new(record)))
            .collect(),
    )
}

pub fn parse(
    stem: &str,
    bytes: &[u8],
    record_size: usize,
    ts: Option<usize>,
    text: &Text,
) -> Value {
    match stem {
        "battle-commands" => array(bytes, record_size, |r| battle_command(r, text, ts)),
        "magic" => array(bytes, record_size, |r| magic(r, text, ts)),
        "junctionable-gfs" => array(bytes, record_size, |r| junctionable_gf(r, text, ts)),
        "enemy-attacks" => array(bytes, record_size, |r| enemy_attack(r, text, ts)),
        "weapons" => array(bytes, record_size, |r| weapon(r, text, ts)),
        "renzokuken-finishers" => array(bytes, record_size, |r| renzokuken(r, text, ts)),
        "characters" => array(bytes, record_size, |r| character(r, text, ts)),
        "battle-items" => array(bytes, record_size, |r| battle_item(r, text, ts)),
        "non-battle-items" => array(bytes, record_size, |r| non_battle_item(r, text, ts)),
        "non-junctionable-gf-attacks" => {
            array(bytes, record_size, |r| non_junction_gf(r, text, ts))
        }
        "command-abilities-in-battle" => array(bytes, record_size, command_in_battle),
        "junction-abilities" => array(bytes, record_size, |r| junction_ability(r, text, ts)),
        "command-abilities-gf" => array(bytes, record_size, |r| command_ability_gf(r, text, ts)),
        "stat-abilities" => array(bytes, record_size, |r| stat_ability(r, text, ts)),
        "character-abilities" => array(bytes, record_size, |r| character_ability(r, text, ts)),
        "party-abilities" => array(bytes, record_size, |r| party_ability(r, text, ts)),
        "gf-abilities" => array(bytes, record_size, |r| gf_ability(r, text, ts)),
        "menu-abilities" => array(bytes, record_size, |r| menu_ability(r, text, ts)),
        "temporary-character-limit-breaks" => {
            array(bytes, record_size, |r| temp_limit(r, text, ts))
        }
        "blue-magic" => array(bytes, record_size, |r| blue_magic(r, text, ts)),
        "blue-magic-parameters" => array(bytes, record_size, blue_magic_parameters),
        "shot" => array(bytes, record_size, |r| shot(r, text, ts)),
        "duel-limit-breaks" => array(bytes, record_size, |r| duel_limit(r, text, ts)),
        "duel-parameters" => array(bytes, record_size, duel_parameters),
        "rinoa-commands" => array(bytes, record_size, |r| rinoa_command(r, text, ts)),
        "rinoa-combine-limit-breaks" => array(bytes, record_size, |r| rinoa_combine(r, text, ts)),
        "slot-array" => json!(bytes),
        "slot-sets" => array(bytes, record_size, slot_set),
        "devour" => array(bytes, record_size, |r| devour(r, text, ts)),
        "misc" => misc(&Reader::new(bytes)),
        "misc-text-pointers" => misc_text_pointers(bytes, text),
        _ => Value::Null,
    }
}

fn battle_command(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "abilityDataId": r.u8(4),
        "flags": r.u8(5),
        "targetInfo": target(r.u8(6)),
        "targetInfoRaw": r.u8(6),
    })
}

fn magic(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "animationId": r.u8(6),
        "attackType": r.u8(7),
        "spellPower": r.u8(8),
        "targetInfo": target(r.u8(10)),
        "attackFlags": r.u8(11),
        "drawResist": r.u8(12),
        "hitCount": r.u8(13),
        "element": elements(r.u8(14)),
        "elementRaw": r.u8(14),
        "statuses": statuses(r.u16(20), r.u32(16)),
        "statusAccuracy": r.u8(22),
        "junction": json!({
            "hp": r.u8(23), "str": r.u8(24), "vit": r.u8(25), "mag": r.u8(26),
            "spr": r.u8(27), "spd": r.u8(28), "eva": r.u8(29), "hit": r.u8(30), "luck": r.u8(31),
        }),
        "elementalAttackJunction": json!({ "element": elements(r.u8(32)), "value": r.u8(33) }),
        "elementalDefenseJunction": json!({ "element": elements(r.u8(34)), "value": r.u8(35) }),
        "statusAttackJunction": json!({ "statuses": statuses(r.u16(38), 0), "value": r.u8(36) }),
        "statusDefenseJunction": json!({ "statuses": statuses(r.u16(40), 0), "value": r.u8(37) }),
        "gfCompatibility": gf_compatibility(r, 42),
    })
}

fn junctionable_gf(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let abilities: Vec<Value> = (0..21)
        .map(|index| {
            let base = 27 + index * 4;
            json!({ "unlocker": r.u8(base), "abilityId": r.u8(base + 2) })
        })
        .collect();
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "specialAction": r.u16(4),
        "attackType": r.u8(6),
        "power": r.u8(7),
        "attackFlags": r.u8(10),
        "targetAnimation": r.u8(11),
        "hitCount": r.u8(12),
        "element": elements(r.u8(13)),
        "statuses": statuses(r.u16(14), r.u32(16)),
        "hpModifiers": [r.u8(20), r.u8(21), r.u8(22)],
        "nextLevelModifiers": [r.u8(24), r.u8(25)],
        "statusAttackEnabler": r.u8(26),
        "abilities": abilities,
        "gfCompatibility": gf_compatibility(r, 112),
    })
}

fn enemy_attack(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "magicId": r.u16(2),
        "cameraChange": r.u8(4),
        "animationId": r.u8(5),
        "attackType": r.u8(6),
        "attackPower": r.u8(7),
        "attackFlags": r.u8(8),
        "element": elements(r.u8(10)),
        "critBonus": r.u8(11),
        "statusEnabler": r.u8(12),
        "attackParameter": r.u8(13),
        "statuses": statuses(r.u16(14), r.u32(16)),
    })
}

fn weapon(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let character = r.u8(4);
    json!({
        "name": name(text, ts, r.u16(0)),
        "renzokukenFinishers": json!(decode_bits(r.u8(2) as u32, &RENZOKUKEN_FINISHERS)),
        "characterId": character,
        "character": CHARACTER_NAMES.get(character as usize).copied(),
        "attackType": r.u8(5),
        "attackPower": r.u8(6),
        "attackParameter": r.u8(7),
        "strBonus": r.u8(8),
        "weaponTier": r.u8(9),
        "critBonus": r.u8(10),
        "meleeWeapon": r.u8(11) != 0,
    })
}

fn renzokuken(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "attackType": r.u8(6),
        "attackPower": r.u8(8),
        "targetInfo": target(r.u8(10)),
        "attackFlags": r.u8(11),
        "hitCount": r.u8(12),
        "element": elements(r.u8(13)),
        "elementPercent": r.u8(14),
        "statusEnabler": r.u8(15),
        "statuses": statuses(r.u16(18), r.u32(20)),
    })
}

fn character(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    // Each stat is four raw curve bytes used by the level→stat growth formula,
    // not a single scalar — emit the bytes verbatim rather than misread them as u32.
    let stat = |offset: usize| {
        json!([
            r.u8(offset),
            r.u8(offset + 1),
            r.u8(offset + 2),
            r.u8(offset + 3)
        ])
    };
    json!({
        "name": name(text, ts, r.u16(0)),
        "crisisHpMultiplier": r.u8(2),
        "gender": if r.u8(3) == 0 { "Male" } else { "Female" },
        "limitBreakId": r.u8(4),
        "limitBreakParam": r.u8(5),
        "expModifier": r.u16(6),
        "statCurves": json!({
            "hp": stat(8), "str": stat(12), "vit": stat(16), "mag": stat(20),
            "spr": stat(24), "spd": stat(28), "luck": stat(32),
        }),
    })
}

fn battle_item(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "attackType": r.u8(6),
        "attackPower": r.u8(7),
        "battleFlag": r.u8(8),
        "targetInfo": target(r.u8(9)),
        "attackFlags": r.u8(11),
        "statusAttackEnabler": r.u8(13),
        "statuses": statuses(r.u16(14), r.u32(16)),
        "attackParameter": r.u8(20),
        "hitCount": r.u8(22),
        "element": elements(r.u8(23)),
    })
}

fn non_battle_item(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
    })
}

fn non_junction_gf(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "specialAction": r.u16(2),
        "attackType": r.u8(4),
        "power": r.u8(5),
        "statusAttackEnabler": r.u8(6),
        "statusFlags": r.u8(8),
        "hitCount": r.u8(10),
        "element": elements(r.u8(11)),
        "statuses": statuses(r.u16(16), r.u32(12)),
        "powerModifier": r.u8(18),
        "levelModifier": r.u8(19),
    })
}

fn command_in_battle(r: &Reader) -> Value {
    json!({
        "magicId": r.u16(0),
        "animationTriggered": r.u8(3),
        "attackType": r.u8(4),
        "attackPower": r.u8(5),
        "attackFlags": r.u8(6),
        "hitCount": r.u8(7),
        "element": elements(r.u8(8)),
        "statusAttackEnabler": r.u8(9),
        "statuses": statuses(r.u16(10), r.u32(12)),
    })
}

fn ability_header(r: &Reader, text: &Text, ts: Option<usize>) -> (Value, Value, u8) {
    (name(text, ts, r.u16(0)), name(text, ts, r.u16(2)), r.u8(4))
}

fn junction_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "junctionFlag": [r.u8(5), r.u8(6), r.u8(7)],
    })
}

fn command_ability_gf(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "battleCommandIndex": r.u8(5),
    })
}

fn stat_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "statType": r.u8(5), "increaseValue": r.u8(6),
    })
}

fn character_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "abilityFlag": [r.u8(5), r.u8(6), r.u8(7)],
    })
}

fn party_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "partyFlag": r.u8(5),
    })
}

fn gf_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "enableBoost": r.u8(5), "statToIncrease": r.u8(6), "increaseValue": r.u8(7),
    })
}

fn menu_ability(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let (name, description, ap) = ability_header(r, text, ts);
    json!({
        "name": name, "description": description, "apRequired": ap,
        "menuFileIndex": r.u8(5), "startOffset": r.u8(6), "endOffset": r.u8(7),
    })
}

fn temp_limit(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "attackType": r.u8(6),
        "attackPower": r.u8(7),
        "targetInfo": target(r.u8(10)),
        "attackFlags": r.u8(11),
        "hitCount": r.u8(12),
        "element": elements(r.u8(13)),
        "elementPercent": r.u8(14),
        "statusAttackEnabler": r.u8(15),
        "statuses": statuses(r.u16(16), r.u32(20)),
    })
}

fn blue_magic(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "specialAction": r.u16(4),
        "attackType": r.u8(7),
        "attackFlags": r.u8(10),
        "hitCount": r.u8(11),
        "element": elements(r.u8(12)),
        "statusAttack": r.u8(13),
        "critBonus": r.u8(14),
    })
}

fn blue_magic_parameters(r: &Reader) -> Value {
    json!({
        "statuses": statuses(r.u16(4), r.u32(0)),
        "attackPower": r.u8(6),
        "attackParameter": r.u8(7),
    })
}

fn shot(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "attackType": r.u8(6),
        "attackPower": r.u8(7),
        "targetInfo": target(r.u8(10)),
        "attackFlags": r.u8(11),
        "hitCount": r.u8(12),
        "element": elements(r.u8(13)),
        "elementPercent": r.u8(14),
        "statusAttackEnabler": r.u8(15),
        "usedItemIndex": r.u8(18),
        "critIncrease": r.u8(19),
        "statuses": statuses(r.u16(16), r.u32(20)),
    })
}

fn sequence_buttons(value: u16) -> Value {
    if value == 0xFFFF {
        return json!([]);
    }
    let pressed: Vec<&str> = SEQUENCE_BUTTONS
        .iter()
        .filter(|(mask, _)| value & mask != 0)
        .map(|(_, label)| *label)
        .collect();
    json!(pressed)
}

fn duel_limit(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    let sequence: Vec<Value> = (0..5)
        .map(|i| sequence_buttons(r.u16(16 + i * 2)))
        .collect();
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "magicId": r.u16(4),
        "attackType": r.u8(6),
        "attackPower": r.u8(7),
        "attackFlags": r.u8(8),
        "targetInfo": target(r.u8(10)),
        "hitCount": r.u8(12),
        "element": elements(r.u8(13)),
        "elementPercent": r.u8(14),
        "statusAttackEnabler": r.u8(15),
        "inputSequence": sequence,
        "statuses": statuses(r.u16(26), r.u32(28)),
    })
}

fn duel_parameters(r: &Reader) -> Value {
    json!({ "startMove": r.u8(0), "next": [r.u8(1), r.u8(2), r.u8(3)] })
}

fn rinoa_command(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "description": name(text, ts, r.u16(2)),
        "flags": r.u8(4),
        "target": r.u8(5),
        "abilityDataId": r.u8(6),
    })
}

fn rinoa_combine(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "name": name(text, ts, r.u16(0)),
        "magicId": r.u16(2),
        "attackType": r.u8(4),
        "attackPower": r.u8(5),
        "attackFlags": r.u8(6),
        "targetInfo": target(r.u8(8)),
        "hitCount": r.u8(10),
        "element": elements(r.u8(11)),
        "elementPercent": r.u8(12),
        "statusAttackEnabler": r.u8(13),
        "statuses": statuses(r.u16(14), r.u32(16)),
    })
}

fn slot_set(r: &Reader) -> Value {
    let magic: Vec<Value> = (0..8)
        .map(|index| json!({ "magicId": r.u8(index * 2), "count": r.u8(index * 2 + 1) }))
        .collect();
    json!({ "magic": magic })
}

fn devour(r: &Reader, text: &Text, ts: Option<usize>) -> Value {
    json!({
        "text": name(text, ts, r.u16(0)),
        "hpStatusEffect": r.u8(2),
        "hpQuantityFlag": r.u8(3),
        "statuses": statuses(r.u16(8), r.u32(4)),
        "statRaise": json!(decode_bits(r.u8(10) as u32, &DEVOUR_STATS)),
        "statQuantity": r.u8(11),
    })
}

fn misc(r: &Reader) -> Value {
    let status_timer_labels = [
        "sleep",
        "haste",
        "slow",
        "stop",
        "regen",
        "protect",
        "shell",
        "reflect",
        "aura",
        "curse",
        "doom",
        "invincible",
        "petrifying",
        "float",
        "atbSpeedMultiplier",
        "deadTimer",
    ];
    let status_timers: serde_json::Map<String, Value> = status_timer_labels
        .iter()
        .enumerate()
        .map(|(index, label)| ((*label).to_string(), json!(r.u8(index))))
        .collect();
    let limit_effect_durations: Vec<Value> = (16..48).map(|offset| json!(r.u8(offset))).collect();
    let duel: Vec<Value> = (0..4)
        .map(|level| {
            let base = 48 + level * 2;
            json!({ "startSequence": r.u8(base), "timer": r.u8(base + 1) })
        })
        .collect();
    let shot_timers: Vec<Value> = (56..60).map(|offset| json!(r.u8(offset))).collect();
    json!({
        "statusTimers": Value::Object(status_timers),
        "limitEffectDurations": limit_effect_durations,
        "duelCrisisLevels": duel,
        "shotCrisisTimers": shot_timers,
    })
}

fn misc_text_pointers(bytes: &[u8], text: &Text) -> Value {
    let reader = Reader::new(bytes);
    let count = bytes.len() / 2;
    let entries: Vec<Value> = (0..count)
        .map(|index| {
            let offset = reader.u16(index * 2);
            json!({ "offset": offset, "text": name(text, Some(55), offset) })
        })
        .collect();
    Value::Array(entries)
}
