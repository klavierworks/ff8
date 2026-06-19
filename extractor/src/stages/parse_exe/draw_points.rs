use anyhow::{Context, Result};
use serde::Serialize;

// Field draw-point table the DRAWPOINT opcode indexes by id (1-based). One byte per draw point:
// low 6 bits = magic id (kernel magic.json index), high 2 bits = a state/refill flag. See ida.md.
const DRAW_POINT_COUNT: usize = 256;
const VIRTUAL_ADDRESS: usize = 0xB9_2328;
const MAGIC_MASK: u8 = 0x3F;
const FLAG_SHIFT: u8 = 6;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawPoint {
    pub id: usize,
    pub magic_id: u8,
    pub flags: u8,
}

pub fn export(exe: &[u8]) -> Result<Vec<DrawPoint>> {
    let offset = VIRTUAL_ADDRESS - super::IMAGE_BASE;
    let end = offset + DRAW_POINT_COUNT;
    let table = exe
        .get(offset..end)
        .with_context(|| format!("draw-point table out of range ({offset:#X}..{end:#X})"))?;
    Ok(table
        .iter()
        .enumerate()
        .map(|(index, &byte)| DrawPoint {
            id: index + 1,
            magic_id: byte & MAGIC_MASK,
            flags: byte >> FLAG_SHIFT,
        })
        .collect())
}
