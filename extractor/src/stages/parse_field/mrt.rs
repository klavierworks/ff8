use anyhow::{bail, Result};

// .mrt — battle formations for the field's encounters. Deling MrtFile: an 8-byte file
// holding four little-endian u16 formation IDs.
pub fn parse_mrt(mrt_bytes: &[u8]) -> Result<[u16; 4]> {
    if mrt_bytes.len() < 8 {
        bail!("mrt file too small: {} bytes", mrt_bytes.len());
    }
    Ok([
        u16::from_le_bytes([mrt_bytes[0], mrt_bytes[1]]),
        u16::from_le_bytes([mrt_bytes[2], mrt_bytes[3]]),
        u16::from_le_bytes([mrt_bytes[4], mrt_bytes[5]]),
        u16::from_le_bytes([mrt_bytes[6], mrt_bytes[7]]),
    ])
}
