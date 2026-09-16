use super::psx_image::ImageEntry;
use crate::utils::disc_image::{Disc, SECTOR_SIZE};
use anyhow::Result;

// A music file opens with a block directory of `u32 block_count` then a `u32 offset, u32 size`
// pair per block. The first block is always the AKAO sequence and always sits immediately after
// that directory, which is what tells a music entry apart from the overlays and sample banks
// sharing the index.
const BLOCK_DIRECTORY_SIZE: u32 = 20;
const FIRST_BLOCK_OFFSET: usize = 4;
const AKAO_MAGIC: &[u8] = b"AKAO";
const SONG_ID_OFFSET: usize = 4;

// A resident bank is a bare AKAO bank block sitting in the index as its own entry, rather than
// inside a music container. The driver loads it once and leaves it in the runtime instrument
// table, where a track's own bank joins it at a higher base.
const BLOCK_KIND_OFFSET: usize = 6;
const BANK_BLOCK_KIND: u16 = 0;
const INSTRUMENT_BASE_OFFSET: usize = 0x18;
const SAMPLE_BYTES_OFFSET: usize = 0x14;
const INSTRUMENT_COUNT_OFFSET: usize = 0x1c;

// Where the tracks' own banks load. A block claiming this base or higher is a music bank and
// reaches the port inside its track, not on its own.
const MUSIC_INSTRUMENT_BASE: u32 = 0x40;
const MAX_INSTRUMENT_COUNT: u32 = 256;

pub struct MusicTrack {
    pub data: Vec<u8>,
    pub song_id: u16,
}

pub struct ResidentBank {
    pub data: Vec<u8>,
    pub instrument_base: u32,
}

pub fn read_music_tracks(disc: &mut Disc, entries: &[ImageEntry]) -> Result<Vec<MusicTrack>> {
    let mut tracks = Vec::new();
    for entry in entries.iter().filter(|entry| !entry.is_empty()) {
        if let Some(track) = read_music_track(disc, entry)? {
            tracks.push(track);
        }
    }
    tracks.sort_by_key(|track| track.song_id);
    Ok(tracks)
}

pub fn read_resident_banks(disc: &mut Disc, entries: &[ImageEntry]) -> Result<Vec<ResidentBank>> {
    let mut banks = Vec::new();
    for entry in entries.iter().filter(|entry| !entry.is_empty()) {
        if let Some(bank) = read_resident_bank(disc, entry)? {
            banks.push(bank);
        }
    }
    banks.sort_by_key(|bank| bank.instrument_base);
    Ok(banks)
}

fn read_resident_bank(disc: &mut Disc, entry: &ImageEntry) -> Result<Option<ResidentBank>> {
    let header = disc.read(entry.lba, SECTOR_SIZE)?;
    let Some(instrument_base) = get_resident_instrument_base(&header) else {
        return Ok(None);
    };
    Ok(Some(ResidentBank {
        data: disc.read(entry.lba, entry.size as usize)?,
        instrument_base,
    }))
}

// Four index entries open with the magic and only two are banks; the other two carry values in
// these fields that no bank could, so every field the loader reads has to be sane before the
// entry is accepted.
fn get_resident_instrument_base(file: &[u8]) -> Option<u32> {
    if file.get(..AKAO_MAGIC.len())? != AKAO_MAGIC {
        return None;
    }
    if read_u16(file, BLOCK_KIND_OFFSET)? != BANK_BLOCK_KIND {
        return None;
    }
    let instrument_base = read_u32(file, INSTRUMENT_BASE_OFFSET)?;
    let instrument_count = read_u32(file, INSTRUMENT_COUNT_OFFSET)?;
    let sample_bytes = read_u32(file, SAMPLE_BYTES_OFFSET)?;
    let is_resident_bank = instrument_base < MUSIC_INSTRUMENT_BASE
        && (1..=MAX_INSTRUMENT_COUNT).contains(&instrument_count)
        && sample_bytes > 0;
    is_resident_bank.then_some(instrument_base)
}

fn read_music_track(disc: &mut Disc, entry: &ImageEntry) -> Result<Option<MusicTrack>> {
    let header = disc.read(entry.lba, SECTOR_SIZE)?;
    let Some(song_id) = get_song_id(&header) else {
        return Ok(None);
    };
    Ok(Some(MusicTrack {
        data: disc.read(entry.lba, entry.size as usize)?,
        song_id,
    }))
}

fn get_song_id(file: &[u8]) -> Option<u16> {
    let sequence = read_u32(file, FIRST_BLOCK_OFFSET)?;
    if sequence != BLOCK_DIRECTORY_SIZE {
        return None;
    }
    let sequence = sequence as usize;
    if file.get(sequence..sequence + AKAO_MAGIC.len())? != AKAO_MAGIC {
        return None;
    }
    read_u16(file, sequence + SONG_ID_OFFSET)
}

fn read_u16(data: &[u8], offset: usize) -> Option<u16> {
    let bytes = data.get(offset..offset + 2)?;
    Some(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    let bytes = data.get(offset..offset + 4)?;
    Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
