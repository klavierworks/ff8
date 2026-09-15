use super::psx_disc::{Disc, SECTOR_SIZE};
use anyhow::{Context as _, Result};

const IMAGE_EXTENSION: &str = ".IMG";
const INDEX_ENTRY_SIZE: usize = 8;

pub struct ImageEntry {
    pub lba: u32,
    pub size: u32,
}

impl ImageEntry {
    pub fn is_empty(&self) -> bool {
        self.size == 0
    }
}

// The disc holds one payload file, `FF8DISCn.IMG`, and it is not a nested filesystem. Its first
// sector is a flat table of `u32 lba, u32 size` pairs whose LBA is an absolute disc sector rather
// than an offset into the IMG. Unused slots are zeroed, and nothing anywhere carries a name — an
// entry is identified by its slot number or by what its bytes turn out to be.
pub fn read_image_index(disc: &mut Disc) -> Result<Vec<ImageEntry>> {
    let root = disc.read_root_directory()?;
    let image = root
        .iter()
        .find(|file| file.name.ends_with(IMAGE_EXTENSION))
        .with_context(|| format!("no *{IMAGE_EXTENSION} payload in the disc root"))?;
    let index = disc.read(image.lba, SECTOR_SIZE)?;
    Ok(parse_index(&index))
}

fn parse_index(sector: &[u8]) -> Vec<ImageEntry> {
    sector
        .chunks_exact(INDEX_ENTRY_SIZE)
        .map(|entry| ImageEntry {
            lba: u32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]),
            size: u32::from_le_bytes([entry[4], entry[5], entry[6], entry[7]]),
        })
        .collect()
}
