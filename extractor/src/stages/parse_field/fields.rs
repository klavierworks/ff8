use crate::utils::fs_archive::{parse_file_list, parse_index, read_entry};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::Path;

pub use crate::utils::field_archive::discover;

pub struct FieldArchive {
    pub name: String,
    pub files: HashMap<String, Vec<u8>>,
}

impl FieldArchive {
    pub fn file(&self, extension: &str) -> Option<&[u8]> {
        self.files.get(extension).map(Vec::as_slice)
    }
}

pub fn unpack(fs_path: &Path) -> Result<FieldArchive> {
    let name = fs_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .context("field archive has no stem")?
        .to_string();

    let fi = std::fs::read(fs_path.with_extension("fi"))?;
    let fl = std::fs::read(fs_path.with_extension("fl"))?;
    let fs = std::fs::read(fs_path)?;

    let entries = parse_index(&fi)?;
    let names = parse_file_list(&fl);
    let mut files = HashMap::new();
    for (entry, full_name) in entries.iter().zip(&names) {
        let extension = full_name.rsplit('.').next().unwrap_or("").to_lowercase();
        let data =
            read_entry(&fs, entry).with_context(|| format!("{name}: reading {full_name}"))?;
        files.insert(extension, data);
    }
    Ok(FieldArchive { name, files })
}
