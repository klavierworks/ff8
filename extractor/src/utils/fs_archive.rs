use super::lzs;
use anyhow::{bail, Context as _, Result};

const ENTRY_SIZE: usize = 12;

pub struct Entry {
    pub uncompressed_size: usize,
    pub offset: usize,
    pub compression: u32,
}

pub fn parse_index(fi: &[u8]) -> Result<Vec<Entry>> {
    if !fi.len().is_multiple_of(ENTRY_SIZE) {
        bail!(
            ".fi length {} is not a multiple of {}",
            fi.len(),
            ENTRY_SIZE
        );
    }
    let entries = fi
        .chunks_exact(ENTRY_SIZE)
        .map(|chunk| Entry {
            uncompressed_size: read_u32(chunk, 0) as usize,
            offset: read_u32(chunk, 4) as usize,
            compression: read_u32(chunk, 8),
        })
        .collect();
    Ok(entries)
}

pub fn parse_file_list(fl: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(fl)
        .split('\n')
        .map(|line| line.trim_end_matches('\r').trim())
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect()
}

pub fn read_entry(fs: &[u8], entry: &Entry) -> Result<Vec<u8>> {
    match entry.compression {
        0 => {
            let end = entry.offset + entry.uncompressed_size;
            let slice = fs
                .get(entry.offset..end)
                .context("stored entry out of bounds")?;
            Ok(slice.to_vec())
        }
        1 => {
            let header = fs
                .get(entry.offset..entry.offset + 4)
                .context("missing LZS length prefix")?;
            let compressed_len = read_u32(header, 0) as usize;
            let start = entry.offset + 4;
            let compressed = fs
                .get(start..start + compressed_len)
                .context("LZS data out of bounds")?;
            let data = lzs::decompress(compressed, entry.uncompressed_size);
            if data.len() != entry.uncompressed_size {
                bail!(
                    "LZS size mismatch: decompressed {} bytes, expected {}",
                    data.len(),
                    entry.uncompressed_size
                );
            }
            Ok(data)
        }
        other => bail!("unknown compression type {}", other),
    }
}

pub fn to_relative_paths(names: &[String]) -> Vec<String> {
    let components: Vec<Vec<&str>> = names
        .iter()
        .map(|name| name.split('\\').collect())
        .collect();
    let strip = common_directory_depth(&components);
    components
        .iter()
        .map(|parts| parts[strip..].join("/"))
        .collect()
}

fn common_directory_depth(components: &[Vec<&str>]) -> usize {
    let max_depth = components
        .iter()
        .map(|parts| parts.len().saturating_sub(1))
        .min()
        .unwrap_or(0);

    let mut depth = 0;
    while depth < max_depth {
        let candidate = components[0][depth];
        let shared = components
            .iter()
            .all(|parts| parts[depth].eq_ignore_ascii_case(candidate));
        if !shared {
            break;
        }
        depth += 1;
    }
    depth
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}
