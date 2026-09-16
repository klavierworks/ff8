use anyhow::{bail, Context as _, Result};
use flate2::read::DeflateDecoder;
use std::io::{self, Read, Seek, SeekFrom, Write};

// InstallShield 5 splits an install into a header file (the file table) and a cabinet file (the
// data). Both open with the same common header; the file table sits under the cabinet descriptor
// the common header points at, and every offset inside it is relative to the start of that table.
const SIGNATURE: &[u8] = b"ISc(";
const VERSION_OFFSET: usize = 4;
const CABINET_DESCRIPTOR_OFFSET: usize = 12;
const SUPPORTED_MAJOR_VERSION: u32 = 5;

const FILE_TABLE_OFFSET: usize = 0x0C;
const DIRECTORY_COUNT_OFFSET: usize = 0x1C;
const FILE_COUNT_OFFSET: usize = 0x28;

const NAME_OFFSET: usize = 0x00;
const DIRECTORY_INDEX_OFFSET: usize = 0x04;
const FLAGS_OFFSET: usize = 0x08;
const EXPANDED_SIZE_OFFSET: usize = 0x0A;
const COMPRESSED_SIZE_OFFSET: usize = 0x0E;
const DATA_OFFSET_OFFSET: usize = 0x26;

const FLAG_SPLIT: u16 = 0x01;
const FLAG_OBFUSCATED: u16 = 0x02;
const FLAG_COMPRESSED: u16 = 0x04;
const FLAG_INVALID: u16 = 0x08;

const PATH_SEPARATOR: char = '\\';

pub struct CabinetFile {
    pub path: String,
    flags: u16,
    expanded_size: u64,
    compressed_size: u64,
    data_offset: u64,
}

pub fn parse_cabinet_header(header: &[u8]) -> Result<Vec<CabinetFile>> {
    if header.get(..SIGNATURE.len()) != Some(SIGNATURE) {
        bail!("not an InstallShield header");
    }
    let major_version = read_major_version(read_u32(header, VERSION_OFFSET)?);
    if major_version != SUPPORTED_MAJOR_VERSION {
        bail!("InstallShield version {major_version} is not supported");
    }

    let descriptor = read_u32(header, CABINET_DESCRIPTOR_OFFSET)? as usize;
    let table = descriptor + read_u32(header, descriptor + FILE_TABLE_OFFSET)? as usize;
    let directory_count = read_u16(header, descriptor + DIRECTORY_COUNT_OFFSET)? as usize;
    let file_count = read_u16(header, descriptor + FILE_COUNT_OFFSET)? as usize;

    let read_entry_offset = |index: usize| -> Result<usize> {
        Ok(table + read_u32(header, table + index * 4)? as usize)
    };
    let directories = (0..directory_count)
        .map(|index| read_c_string(header, read_entry_offset(index)?))
        .collect::<Result<Vec<_>>>()?;

    (0..file_count)
        .map(|index| {
            let record = read_entry_offset(directory_count + index)?;
            parse_file_record(header, table, record, &directories)
        })
        .filter(|file| {
            !file
                .as_ref()
                .is_ok_and(|file| file.flags & FLAG_INVALID != 0)
        })
        .collect()
}

// Version 5 headers store the major version in the second nibble of the third byte.
fn read_major_version(version: u32) -> u32 {
    (version >> 12) & 0xF
}

fn parse_file_record(
    header: &[u8],
    table: usize,
    record: usize,
    directories: &[String],
) -> Result<CabinetFile> {
    let name = read_c_string(
        header,
        table + read_u32(header, record + NAME_OFFSET)? as usize,
    )?;
    let directory_index = read_u32(header, record + DIRECTORY_INDEX_OFFSET)? as usize;
    let directory = directories
        .get(directory_index)
        .with_context(|| format!("{name}: directory index {directory_index} out of range"))?;
    Ok(CabinetFile {
        path: join_cabinet_path(directory, &name),
        flags: read_u16(header, record + FLAGS_OFFSET)?,
        expanded_size: u64::from(read_u32(header, record + EXPANDED_SIZE_OFFSET)?),
        compressed_size: u64::from(read_u32(header, record + COMPRESSED_SIZE_OFFSET)?),
        data_offset: u64::from(read_u32(header, record + DATA_OFFSET_OFFSET)?),
    })
}

fn join_cabinet_path(directory: &str, name: &str) -> String {
    directory
        .split(PATH_SEPARATOR)
        .chain(std::iter::once(name))
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

pub fn extract_cabinet_file(
    cabinet: &mut (impl Read + Seek),
    file: &CabinetFile,
    out: &mut impl Write,
) -> Result<()> {
    if file.flags & (FLAG_SPLIT | FLAG_OBFUSCATED) != 0 {
        bail!("{}: split or obfuscated files are not supported", file.path);
    }
    cabinet.seek(SeekFrom::Start(file.data_offset))?;

    let written = if file.flags & FLAG_COMPRESSED != 0 {
        inflate_chunks(cabinet, file.compressed_size, out)?
    } else {
        io::copy(&mut cabinet.take(file.expanded_size), out)?
    };
    if written != file.expanded_size {
        bail!(
            "{}: expanded to {written} bytes, header says {}",
            file.path,
            file.expanded_size
        );
    }
    Ok(())
}

// Compressed data is a run of chunks, each a u16 length followed by an independent raw deflate
// stream.
fn inflate_chunks(
    cabinet: &mut impl Read,
    compressed_size: u64,
    out: &mut impl Write,
) -> Result<u64> {
    let mut consumed = 0u64;
    let mut written = 0u64;
    let mut chunk = Vec::new();
    while consumed < compressed_size {
        let mut length = [0u8; 2];
        cabinet.read_exact(&mut length)?;
        let length = u16::from_le_bytes(length) as usize;
        chunk.resize(length, 0);
        cabinet.read_exact(&mut chunk)?;
        written += io::copy(&mut DeflateDecoder::new(chunk.as_slice()), out)
            .context("inflating cabinet chunk")?;
        consumed += 2 + length as u64;
    }
    Ok(written)
}

fn read_c_string(data: &[u8], offset: usize) -> Result<String> {
    let bytes = data
        .get(offset..)
        .with_context(|| format!("string at {offset:#X} past end of header"))?;
    let end = bytes
        .iter()
        .position(|&byte| byte == 0)
        .with_context(|| format!("unterminated string at {offset:#X}"))?;
    Ok(String::from_utf8_lossy(&bytes[..end]).into_owned())
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let Some(bytes) = data.get(offset..offset + 2) else {
        bail!("u16 at {offset:#X} past end of header");
    };
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let Some(bytes) = data.get(offset..offset + 4) else {
        bail!("u32 at {offset:#X} past end of header");
    };
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
