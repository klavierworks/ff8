use crate::stage::{Context, Stage};
use crate::utils::fs_archive::{parse_file_list, parse_index, read_entry, to_relative_paths};
use crate::utils::stamp::{build_stamp, is_stamp_current, write_stamp};
use anyhow::{bail, Context as _, Result};
use std::fs;
use std::path::{Path, PathBuf};

const ARCHIVE_DIR: &str = "Data";
const STAMP_FILE_NAME: &str = "stamp.json";

pub struct DecompressFs;

impl Stage for DecompressFs {
    fn name(&self) -> &'static str {
        "decompress_fs"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let archive_dir = context.install_dir.join(ARCHIVE_DIR);
        let archives = discover_archives(&archive_dir)?;
        if archives.is_empty() {
            bail!("no .fs/.fi/.fl archives found in {}", archive_dir.display());
        }

        let stamp = build_stamp(&list_archive_files(&archives))?;
        let stamp_path = context.uncompressed_dir.join(STAMP_FILE_NAME);
        if context.should_use_cache && is_stamp_current(&stamp_path, &stamp) {
            println!("  up to date, skipping");
            return Ok(());
        }
        if stamp_path.exists() {
            fs::remove_file(&stamp_path)?;
        }

        for archive in &archives {
            extract_archive(archive, &context.uncompressed_dir)?;
        }
        write_stamp(&stamp_path, &stamp)
    }
}

struct Archive {
    name: String,
    fs_path: PathBuf,
    fi_path: PathBuf,
    fl_path: PathBuf,
}

fn list_archive_files(archives: &[Archive]) -> Vec<PathBuf> {
    archives
        .iter()
        .flat_map(|archive| {
            [
                archive.fs_path.clone(),
                archive.fi_path.clone(),
                archive.fl_path.clone(),
            ]
        })
        .collect()
}

fn discover_archives(dir: &Path) -> Result<Vec<Archive>> {
    let mut archives = Vec::new();
    let entries = fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))?;
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("fs") {
            continue;
        }
        let fi_path = path.with_extension("fi");
        let fl_path = path.with_extension("fl");
        if !fi_path.exists() || !fl_path.exists() {
            continue;
        }
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .context("archive has no file stem")?
            .to_string();
        archives.push(Archive {
            name,
            fs_path: path,
            fi_path,
            fl_path,
        });
    }
    archives.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(archives)
}

fn extract_archive(archive: &Archive, output_root: &Path) -> Result<()> {
    let fi = fs::read(&archive.fi_path)?;
    let fl = fs::read(&archive.fl_path)?;
    let fs_data = fs::read(&archive.fs_path)?;

    let entries = parse_index(&fi)?;
    let names = parse_file_list(&fl);
    if entries.len() != names.len() {
        bail!(
            "{}: {} index entries but {} file names",
            archive.name,
            entries.len(),
            names.len()
        );
    }
    let relative_paths = to_relative_paths(&names);

    let out_dir = output_root.join(&archive.name);
    if out_dir.exists() {
        fs::remove_dir_all(&out_dir).with_context(|| format!("clearing {}", out_dir.display()))?;
    }

    let mut total_bytes = 0usize;
    for (entry, relative) in entries.iter().zip(&relative_paths) {
        let data = read_entry(&fs_data, entry)
            .with_context(|| format!("{}: failed to read {}", archive.name, relative))?;
        let destination = out_dir.join(relative);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&destination, &data)?;
        total_bytes += data.len();
    }

    println!(
        "  {}: {} files, {} MB -> {}",
        archive.name,
        entries.len(),
        total_bytes / (1024 * 1024),
        out_dir.display()
    );
    Ok(())
}
