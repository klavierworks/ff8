const SECTION_COUNT: usize = 56;
const FIRST_POINTER_OFFSET: usize = 0x04;

pub struct TextSection {
    pub index: usize,
    pub stem: &'static str,
}

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
