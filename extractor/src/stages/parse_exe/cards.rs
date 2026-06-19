use crate::utils::ff8_text::TextCodec;
use anyhow::{bail, Context, Result};
use serde::Serialize;

// Triple Triad card data lives in two parallel EXE tables, both in card-id order (Geezard..Squall).
// Stats: 8-byte records [top, bottom, left, right, element, aiValue, pad, pad]; powers are U/D/L/R,
// not the U/R/D/L the UI reads. Names: a flat NUL-terminated FF8-text pool. See ida.md "Triple Triad".
const CARD_COUNT: usize = 110;
const STATS_VIRTUAL_ADDRESS: usize = 0xC74D00;
const NAMES_VIRTUAL_ADDRESS: usize = 0xC75152;
const STAT_STRIDE: usize = 8;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: usize,
    pub name: String,
    pub top: u8,
    pub right: u8,
    pub bottom: u8,
    pub left: u8,
    pub element: &'static str,
    pub ai_value: u8,
}

pub fn export(exe: &[u8], codec: &TextCodec) -> Result<Vec<Card>> {
    let stats_offset = STATS_VIRTUAL_ADDRESS - super::IMAGE_BASE;
    let names_offset = NAMES_VIRTUAL_ADDRESS - super::IMAGE_BASE;
    let stats_end = stats_offset + CARD_COUNT * STAT_STRIDE;
    let stats = exe.get(stats_offset..stats_end).with_context(|| {
        format!("card stat table out of range ({stats_offset:#X}..{stats_end:#X})")
    })?;
    if names_offset >= exe.len() {
        bail!("card name pool offset {names_offset:#X} past end of exe");
    }

    let mut name_cursor = names_offset;
    (0..CARD_COUNT)
        .map(|id| {
            let (name, next) = codec.decode_string(exe, name_cursor);
            name_cursor = next;
            let base = id * STAT_STRIDE;
            Ok(Card {
                id,
                name,
                top: stats[base],
                right: stats[base + 3],
                bottom: stats[base + 1],
                left: stats[base + 2],
                element: element_for_flag(stats[base + 4])?,
                ai_value: stats[base + 5],
            })
        })
        .collect()
}

// Element is a single bitflag in byte 4 of the stat record.
fn element_for_flag(flag: u8) -> Result<&'static str> {
    Ok(match flag {
        0x00 => "none",
        0x01 => "water",
        0x02 => "holy",
        0x04 => "fire",
        0x08 => "ice",
        0x10 => "thunder",
        0x20 => "earth",
        0x40 => "poison",
        0x80 => "wind",
        other => bail!("unknown card element flag {other:#X}"),
    })
}
