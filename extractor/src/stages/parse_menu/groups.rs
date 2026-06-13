const ENTRY_SIZE: usize = 8;
const EMPTY: u32 = 0xFFFF_FFFF;

pub struct Group {
    pub index: usize,
    pub offset: usize,
    pub size: usize,
}

// mngrphd.bin is 256 fixed entries of {offset u32, size u32}. Offsets are 1-based
// into mngrp.bin (byte offset = offset - 1); 0xFFFFFFFF / zero size marks an empty slot.
pub fn parse(header: &[u8]) -> Vec<Group> {
    header
        .chunks_exact(ENTRY_SIZE)
        .enumerate()
        .filter_map(|(index, entry)| {
            let offset = u32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]);
            let size = u32::from_le_bytes([entry[4], entry[5], entry[6], entry[7]]) as usize;
            if offset == EMPTY || size == 0 {
                return None;
            }
            Some(Group {
                index,
                offset: (offset as usize).saturating_sub(1),
                size,
            })
        })
        .collect()
}
