use anyhow::{bail, Context as _, Result};
use flate2::read::DeflateDecoder;
use std::io::Read;

const END_OF_DIRECTORY_SIGNATURE: u32 = 0x0605_4B50;
const END_OF_DIRECTORY_SIZE: usize = 22;
const MAX_ARCHIVE_COMMENT: usize = 0xFFFF;
const ENTRY_COUNT_OFFSET: usize = 10;
const DIRECTORY_OFFSET_OFFSET: usize = 16;

const DIRECTORY_ENTRY_SIGNATURE: u32 = 0x0201_4B50;
const DIRECTORY_ENTRY_SIZE: usize = 46;
const METHOD_OFFSET: usize = 10;
const COMPRESSED_SIZE_OFFSET: usize = 20;
const UNCOMPRESSED_SIZE_OFFSET: usize = 24;
const NAME_LENGTH_OFFSET: usize = 28;
const EXTRA_LENGTH_OFFSET: usize = 30;
const COMMENT_LENGTH_OFFSET: usize = 32;
const LOCAL_HEADER_OFFSET_OFFSET: usize = 42;

const LOCAL_HEADER_SIGNATURE: u32 = 0x0403_4B50;
const LOCAL_HEADER_SIZE: usize = 30;
const LOCAL_NAME_LENGTH_OFFSET: usize = 26;
const LOCAL_EXTRA_LENGTH_OFFSET: usize = 28;

const METHOD_STORED: u16 = 0;
const METHOD_DEFLATE: u16 = 8;

struct ArchiveEntry {
    method: u16,
    compressed_size: usize,
    uncompressed_size: usize,
    local_header_offset: usize,
}

pub fn read_archive_file(archive: &[u8], name: &str) -> Result<Vec<u8>> {
    let entry = find_entry(archive, name)?;
    let local = entry.local_header_offset;
    if read_u32(archive, local)? != LOCAL_HEADER_SIGNATURE {
        bail!("{name}: no local header at {local:#X}");
    }
    let data_start = local
        + LOCAL_HEADER_SIZE
        + read_u16(archive, local + LOCAL_NAME_LENGTH_OFFSET)? as usize
        + read_u16(archive, local + LOCAL_EXTRA_LENGTH_OFFSET)? as usize;
    let data = archive
        .get(data_start..data_start + entry.compressed_size)
        .with_context(|| format!("{name}: data runs past end of archive"))?;

    let contents = match entry.method {
        METHOD_STORED => data.to_vec(),
        METHOD_DEFLATE => {
            let mut out = Vec::with_capacity(entry.uncompressed_size);
            DeflateDecoder::new(data)
                .read_to_end(&mut out)
                .with_context(|| format!("inflating {name}"))?;
            out
        }
        other => bail!("{name}: unsupported compression method {other}"),
    };
    if contents.len() != entry.uncompressed_size {
        bail!(
            "{name}: expanded to {} bytes, archive says {}",
            contents.len(),
            entry.uncompressed_size
        );
    }
    Ok(contents)
}

fn find_entry(archive: &[u8], name: &str) -> Result<ArchiveEntry> {
    let end_of_directory = find_end_of_directory(archive)?;
    let entry_count = read_u16(archive, end_of_directory + ENTRY_COUNT_OFFSET)?;
    let mut position = read_u32(archive, end_of_directory + DIRECTORY_OFFSET_OFFSET)? as usize;

    for _ in 0..entry_count {
        if read_u32(archive, position)? != DIRECTORY_ENTRY_SIGNATURE {
            bail!("no central directory entry at {position:#X}");
        }
        let name_length = read_u16(archive, position + NAME_LENGTH_OFFSET)? as usize;
        let name_start = position + DIRECTORY_ENTRY_SIZE;
        let entry_name = archive
            .get(name_start..name_start + name_length)
            .context("entry name runs past end of archive")?;
        if entry_name.eq_ignore_ascii_case(name.as_bytes()) {
            return Ok(ArchiveEntry {
                method: read_u16(archive, position + METHOD_OFFSET)?,
                compressed_size: read_u32(archive, position + COMPRESSED_SIZE_OFFSET)? as usize,
                uncompressed_size: read_u32(archive, position + UNCOMPRESSED_SIZE_OFFSET)? as usize,
                local_header_offset: read_u32(archive, position + LOCAL_HEADER_OFFSET_OFFSET)?
                    as usize,
            });
        }
        position = name_start
            + name_length
            + read_u16(archive, position + EXTRA_LENGTH_OFFSET)? as usize
            + read_u16(archive, position + COMMENT_LENGTH_OFFSET)? as usize;
    }
    bail!("{name} not found in archive")
}

// The end-of-directory record is followed by a variable-length comment, so it has to be found by
// scanning backwards for its signature.
fn find_end_of_directory(archive: &[u8]) -> Result<usize> {
    let last = archive
        .len()
        .checked_sub(END_OF_DIRECTORY_SIZE)
        .context("archive too small")?;
    let first = last.saturating_sub(MAX_ARCHIVE_COMMENT);
    (first..=last)
        .rev()
        .find(|&position| read_u32(archive, position).ok() == Some(END_OF_DIRECTORY_SIGNATURE))
        .context("no end-of-directory record")
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let Some(bytes) = data.get(offset..offset + 2) else {
        bail!("u16 at {offset:#X} past end of archive");
    };
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let Some(bytes) = data.get(offset..offset + 4) else {
        bail!("u32 at {offset:#X} past end of archive");
    };
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
