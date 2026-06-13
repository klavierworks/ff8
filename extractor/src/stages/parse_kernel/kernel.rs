const SECTION_COUNT: usize = 56;
const FIRST_POINTER_OFFSET: usize = 0x04;

pub struct TextSection {
    pub index: usize,
    pub stem: &'static str,
}

// Binary data sections (file sections 0-30). `record_size` is the fixed stride for
// array sections (0 = a single non-array struct). `text` is the file index of the
// text-string section that this section's name/description u16 offsets resolve into.
// NOTE: in the file, duel-zell-limit-break (section 22) precedes duel-parameters
// (section 23) — the reverse of the wiki's documentation order; confirmed by bytes.
pub struct DataSection {
    pub index: usize,
    pub stem: &'static str,
    pub record_size: usize,
    pub text: Option<usize>,
}

pub const DATA_SECTIONS: &[DataSection] = &[
    DataSection {
        index: 0,
        stem: "battle-commands",
        record_size: 8,
        text: Some(31),
    },
    DataSection {
        index: 1,
        stem: "magic",
        record_size: 60,
        text: Some(32),
    },
    DataSection {
        index: 2,
        stem: "junctionable-gfs",
        record_size: 132,
        text: Some(33),
    },
    DataSection {
        index: 3,
        stem: "enemy-attacks",
        record_size: 20,
        text: Some(34),
    },
    DataSection {
        index: 4,
        stem: "weapons",
        record_size: 12,
        text: Some(35),
    },
    DataSection {
        index: 5,
        stem: "renzokuken-finishers",
        record_size: 24,
        text: Some(36),
    },
    DataSection {
        index: 6,
        stem: "characters",
        record_size: 36,
        text: Some(37),
    },
    DataSection {
        index: 7,
        stem: "battle-items",
        record_size: 24,
        text: Some(38),
    },
    DataSection {
        index: 8,
        stem: "non-battle-items",
        record_size: 4,
        text: Some(39),
    },
    DataSection {
        index: 9,
        stem: "non-junctionable-gf-attacks",
        record_size: 20,
        text: Some(40),
    },
    DataSection {
        index: 10,
        stem: "command-abilities-in-battle",
        record_size: 16,
        text: None,
    },
    DataSection {
        index: 11,
        stem: "junction-abilities",
        record_size: 8,
        text: Some(41),
    },
    DataSection {
        index: 12,
        stem: "command-abilities-gf",
        record_size: 8,
        text: Some(42),
    },
    DataSection {
        index: 13,
        stem: "stat-abilities",
        record_size: 8,
        text: Some(43),
    },
    DataSection {
        index: 14,
        stem: "character-abilities",
        record_size: 8,
        text: Some(44),
    },
    DataSection {
        index: 15,
        stem: "party-abilities",
        record_size: 8,
        text: Some(45),
    },
    DataSection {
        index: 16,
        stem: "gf-abilities",
        record_size: 8,
        text: Some(46),
    },
    DataSection {
        index: 17,
        stem: "menu-abilities",
        record_size: 8,
        text: Some(47),
    },
    DataSection {
        index: 18,
        stem: "temporary-character-limit-breaks",
        record_size: 24,
        text: Some(48),
    },
    DataSection {
        index: 19,
        stem: "blue-magic",
        record_size: 16,
        text: Some(49),
    },
    DataSection {
        index: 20,
        stem: "blue-magic-parameters",
        record_size: 8,
        text: None,
    },
    DataSection {
        index: 21,
        stem: "shot",
        record_size: 24,
        text: Some(50),
    },
    DataSection {
        index: 22,
        stem: "duel-limit-breaks",
        record_size: 32,
        text: Some(51),
    },
    DataSection {
        index: 23,
        stem: "duel-parameters",
        record_size: 4,
        text: None,
    },
    DataSection {
        index: 24,
        stem: "rinoa-commands",
        record_size: 8,
        text: Some(52),
    },
    DataSection {
        index: 25,
        stem: "rinoa-combine-limit-breaks",
        record_size: 20,
        text: Some(53),
    },
    DataSection {
        index: 26,
        stem: "slot-array",
        record_size: 1,
        text: None,
    },
    DataSection {
        index: 27,
        stem: "slot-sets",
        record_size: 16,
        text: None,
    },
    DataSection {
        index: 28,
        stem: "devour",
        record_size: 12,
        text: Some(54),
    },
    DataSection {
        index: 29,
        stem: "misc",
        record_size: 0,
        text: None,
    },
    DataSection {
        index: 30,
        stem: "misc-text-pointers",
        record_size: 2,
        text: None,
    },
];

pub const TEXT_SECTIONS: &[TextSection] = &[
    TextSection {
        index: 31,
        stem: "battle-commands",
    },
    TextSection {
        index: 32,
        stem: "magic",
    },
    TextSection {
        index: 33,
        stem: "guardian-forces",
    },
    TextSection {
        index: 34,
        stem: "enemy-attacks",
    },
    TextSection {
        index: 35,
        stem: "weapons",
    },
    TextSection {
        index: 36,
        stem: "renzokuken-finishers",
    },
    TextSection {
        index: 37,
        stem: "character-names",
    },
    TextSection {
        index: 38,
        stem: "battle-items",
    },
    TextSection {
        index: 39,
        stem: "items",
    },
    TextSection {
        index: 40,
        stem: "gf-attacks",
    },
    TextSection {
        index: 41,
        stem: "junction-abilities",
    },
    TextSection {
        index: 42,
        stem: "command-abilities",
    },
    TextSection {
        index: 43,
        stem: "stat-abilities",
    },
    TextSection {
        index: 44,
        stem: "character-abilities",
    },
    TextSection {
        index: 45,
        stem: "party-abilities",
    },
    TextSection {
        index: 46,
        stem: "gf-abilities",
    },
    TextSection {
        index: 47,
        stem: "menu-abilities",
    },
    TextSection {
        index: 48,
        stem: "limit-breaks",
    },
    TextSection {
        index: 49,
        stem: "blue-magic",
    },
    TextSection {
        index: 50,
        stem: "shot",
    },
    TextSection {
        index: 51,
        stem: "duel",
    },
    TextSection {
        index: 52,
        stem: "rinoa-limit-1",
    },
    TextSection {
        index: 53,
        stem: "rinoa-limit-2",
    },
    TextSection {
        index: 54,
        stem: "devour",
    },
    TextSection {
        index: 55,
        stem: "misc",
    },
];

pub fn read_section_pointers(kernel: &[u8]) -> Vec<usize> {
    (0..SECTION_COUNT)
        .map(|section| {
            let offset = FIRST_POINTER_OFFSET + section * 4;
            u32::from_le_bytes([
                kernel[offset],
                kernel[offset + 1],
                kernel[offset + 2],
                kernel[offset + 3],
            ]) as usize
        })
        .collect()
}

pub fn section_range(pointers: &[usize], index: usize, file_len: usize) -> (usize, usize) {
    let start = pointers[index];
    let end = pointers.get(index + 1).copied().unwrap_or(file_len);
    (start, end)
}
