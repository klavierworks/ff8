use anyhow::{bail, Context as _, Result};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

// A PlayStation disc image stores Mode 2 Form 1 sectors: 12 bytes of sync, 4 of header and 8 of
// subheader ahead of the user data, then 280 bytes of error correction after it. An "LBA" here is
// a raw sector index into the image.
const RAW_SECTOR_SIZE: u64 = 2352;
const USER_DATA_OFFSET: u64 = 24;
pub const SECTOR_SIZE: usize = 2048;

const DISC_IMAGE_EXTENSION: &str = "bin";

const PRIMARY_VOLUME_DESCRIPTOR_LBA: u32 = 16;
const VOLUME_DESCRIPTOR_MAGIC: &[u8] = b"CD001";
const VOLUME_DESCRIPTOR_MAGIC_OFFSET: usize = 1;
const ROOT_DIRECTORY_RECORD_OFFSET: usize = 156;

const EXTENT_LBA_OFFSET: usize = 2;
const DATA_LENGTH_OFFSET: usize = 10;
const NAME_LENGTH_OFFSET: usize = 32;
const NAME_OFFSET: usize = 33;
const VERSION_SEPARATOR: char = ';';

// ISO 9660 names the two self-referential entries of every directory with a single control byte
// rather than a printable name.
const CURRENT_DIRECTORY: u8 = 0;
const PARENT_DIRECTORY: u8 = 1;

pub struct Disc {
    file: File,
}

pub struct DiscFile {
    pub lba: u32,
    pub name: String,
}

pub fn find_disc_image(dir: &Path) -> Result<Option<PathBuf>> {
    if !dir.is_dir() {
        return Ok(None);
    }
    let mut images = Vec::new();
    for entry in fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))? {
        let path = entry?.path();
        if path.extension().and_then(|extension| extension.to_str()) == Some(DISC_IMAGE_EXTENSION) {
            images.push(path);
        }
    }
    images.sort();
    Ok(images.into_iter().next())
}

impl Disc {
    pub fn open(path: &Path) -> Result<Self> {
        let file = File::open(path).with_context(|| format!("opening {}", path.display()))?;
        Ok(Self { file })
    }

    pub fn read(&mut self, lba: u32, size: usize) -> Result<Vec<u8>> {
        let mut out = Vec::with_capacity(size);
        let mut sector = [0u8; SECTOR_SIZE];
        let mut index = 0;
        while out.len() < size {
            self.read_sector(lba + index, &mut sector)?;
            let wanted = (size - out.len()).min(SECTOR_SIZE);
            out.extend_from_slice(&sector[..wanted]);
            index += 1;
        }
        Ok(out)
    }

    pub fn read_root_directory(&mut self) -> Result<Vec<DiscFile>> {
        let descriptor = self.read(PRIMARY_VOLUME_DESCRIPTOR_LBA, SECTOR_SIZE)?;
        let magic_end = VOLUME_DESCRIPTOR_MAGIC_OFFSET + VOLUME_DESCRIPTOR_MAGIC.len();
        if descriptor.get(VOLUME_DESCRIPTOR_MAGIC_OFFSET..magic_end)
            != Some(VOLUME_DESCRIPTOR_MAGIC)
        {
            bail!("no ISO 9660 volume descriptor at sector {PRIMARY_VOLUME_DESCRIPTOR_LBA}");
        }
        let root = &descriptor[ROOT_DIRECTORY_RECORD_OFFSET..];
        let lba = read_u32(root, EXTENT_LBA_OFFSET)?;
        let size = read_u32(root, DATA_LENGTH_OFFSET)? as usize;
        let directory = self.read(lba, size)?;
        Ok(parse_directory(&directory))
    }

    fn read_sector(&mut self, lba: u32, out: &mut [u8; SECTOR_SIZE]) -> Result<()> {
        let position = u64::from(lba) * RAW_SECTOR_SIZE + USER_DATA_OFFSET;
        self.file.seek(SeekFrom::Start(position))?;
        self.file
            .read_exact(out)
            .with_context(|| format!("reading sector {lba}"))
    }
}

// A directory record never straddles a sector, so a zero length byte means the rest of the sector
// is padding rather than the end of the directory.
fn parse_directory(data: &[u8]) -> Vec<DiscFile> {
    let mut files = Vec::new();
    let mut position = 0;
    while position < data.len() {
        let length = data[position] as usize;
        if length == 0 {
            position = (position / SECTOR_SIZE + 1) * SECTOR_SIZE;
            continue;
        }
        let Some(record) = data.get(position..position + length) else {
            break;
        };
        if let Some(file) = parse_record(record) {
            files.push(file);
        }
        position += length;
    }
    files
}

fn parse_record(record: &[u8]) -> Option<DiscFile> {
    let name_length = *record.get(NAME_LENGTH_OFFSET)? as usize;
    let name_bytes = record.get(NAME_OFFSET..NAME_OFFSET + name_length)?;
    if matches!(name_bytes, [CURRENT_DIRECTORY] | [PARENT_DIRECTORY]) {
        return None;
    }
    let name = String::from_utf8_lossy(name_bytes);
    Some(DiscFile {
        lba: read_u32(record, EXTENT_LBA_OFFSET).ok()?,
        name: name.split(VERSION_SEPARATOR).next()?.to_string(),
    })
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let Some(bytes) = data.get(offset..offset + 4) else {
        bail!("u32 at {offset} runs past the {} byte record", data.len());
    };
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
