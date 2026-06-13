use anyhow::{bail, Result};

// .rat — field battle-encounter rate. Deling RatFile: a 4-byte file whose first byte
// is the encounter rate (the remaining 3 bytes are unused padding).
pub fn parse_rat(rat_bytes: &[u8]) -> Result<u8> {
    match rat_bytes.first() {
        Some(&rate) => Ok(rate),
        None => bail!("rat file is empty"),
    }
}
