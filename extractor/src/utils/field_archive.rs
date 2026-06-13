use super::fs_archive::{parse_file_list, parse_index, read_entry};
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

pub fn discover(mapdata_dir: &Path) -> Result<Vec<PathBuf>> {
    let mut archives = Vec::new();
    let two_letter = std::fs::read_dir(mapdata_dir)
        .with_context(|| format!("reading {}", mapdata_dir.display()))?;
    for area in two_letter {
        let area_path = area?.path();
        if !area_path.is_dir() {
            continue;
        }
        for entry in std::fs::read_dir(&area_path)? {
            let path = entry?.path();
            if path.extension().and_then(|extension| extension.to_str()) == Some("fs") {
                archives.push(path);
            }
        }
    }
    archives.sort();
    Ok(archives)
}

pub fn read_named_entry(fs_path: &Path, suffix: &str) -> Result<Option<Vec<u8>>> {
    let fi = std::fs::read(fs_path.with_extension("fi"))?;
    let fs = std::fs::read(fs_path)?;
    let fl = std::fs::read(fs_path.with_extension("fl"))?;

    let entries = parse_index(&fi)?;
    let names = parse_file_list(&fl);
    for (entry, full_name) in entries.iter().zip(&names) {
        if full_name.to_lowercase().ends_with(suffix) {
            let data = read_entry(&fs, entry)
                .with_context(|| format!("{}: reading {full_name}", fs_path.display()))?;
            return Ok(Some(data));
        }
    }
    Ok(None)
}
